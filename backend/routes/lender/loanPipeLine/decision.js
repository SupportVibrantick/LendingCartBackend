const crypto = require("crypto");

const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");
const {
  sendEmailUsingKafka,
} = require("../../../services/kafka/email/producer");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderDecisionRoutes(fastify) {
  fastify.patch(
    "/:applicationLenderId/decision",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Lender decision (Conditional / Approved / Declined)",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["decision"],
          properties: {
            decision: {
              type: "string",
              enum: ["CONDITIONAL", "APPROVED", "DECLINED"],
            },
            approvedAmount: { type: "number" },
            interestRate: { type: "number" },
            notes: { type: "string" },
            documentTypeIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK
        =============================== */
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const userId = req.user.id;

        const { applicationLenderId } = req.params;

        const {
          decision,
          approvedAmount,
          interestRate,
          notes,
          documentTypeIds,
        } = req.body;

        /* ===============================
           FETCH APPLICATION
        =============================== */
        const record = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId,
          },
          include: {
            loanApplication: {
              include: {
                client: true,
                submissions: {
                  include: { fields: true },
                },
              },
            },
          },
        });

        if (!record) {
          return reply.status(404).send({
            success: false,
            message: "Application not found",
          });
        }

        if (["APPROVED", "DECLINED"].includes(record.status)) {
          return reply.status(400).send({
            success: false,
            message: "Final decision already made",
          });
        }

        /* ===============================
           EXTRACT CLIENT EMAIL
        =============================== */
        let clientEmail = null;

        for (const submission of record.loanApplication.submissions || []) {
          const emailField = submission.fields.find(
            (f) => f.fieldKey === "email"
          );

          if (emailField) {
            clientEmail = emailField.value;
            break;
          }
        }

        if (!clientEmail) {
          return reply.status(400).send({
            success: false,
            message: "Client email not found",
          });
        }

        /* ===============================
           DECISION MAP
        =============================== */
        let lenderStatus;
        let reviewStatus;

        switch (decision) {
          case "CONDITIONAL":
            lenderStatus = "IN_REVIEW";
            reviewStatus = "CONDITIONAL";
            break;
          case "APPROVED":
            lenderStatus = "APPROVED";
            reviewStatus = "APPROVED";
            break;
          case "DECLINED":
            lenderStatus = "DECLINED";
            reviewStatus = "DECLINED";
            break;
        }

        const previousLoanStatus = record.loanApplication.status;

        let uploadToken = null;

        /* ===============================
           TRANSACTION
        =============================== */
        await prisma.$transaction(async (tx) => {
          // Update lender status
          await tx.applicationLender.update({
            where: { id: applicationLenderId },
            data: {
              status: lenderStatus,
              lastUpdatedAt: new Date(),
            },
          });

          // Save review
          await tx.lenderReview.create({
            data: {
              applicationLenderId,
              reviewedByUserId: userId,
              reviewStatus,
              approvedAmount: decision === "APPROVED" ? approvedAmount : null,
              interestRate: decision === "APPROVED" ? interestRate : null,
              notes: notes || null,
            },
          });

          /* ===============================
             CONDITIONAL FLOW (FIXED + EXTENDED)
          =============================== */
          if (decision === "CONDITIONAL") {
            if (!documentTypeIds || documentTypeIds.length === 0) {
              throw new Error("Please select at least one document");
            }

            // -------------------------------
            // GLOBAL REQUIREMENTS (UNCHANGED)
            // -------------------------------
            const existingRequirements =
              await tx.applicationDocumentRequirement.findMany({
                where: {
                  loanApplicationId: record.loanApplicationId,
                },
                select: { id: true, documentTypeId: true },
              });

            const existingMap = new Map(
              existingRequirements.map((r) => [r.documentTypeId, r])
            );

            for (const docId of documentTypeIds) {
              const existing = existingMap.get(docId);

              if (existing) {
                await tx.applicationDocumentRequirement.update({
                  where: { id: existing.id },
                  data: {
                    status: "PENDING",
                    lastRequestedAt: new Date(),
                    updatedAt: new Date(),
                    source: "LENDER_ADDED",
                  },
                });
              } else {
                await tx.applicationDocumentRequirement.create({
                  data: {
                    loanApplicationId: record.loanApplicationId,
                    documentTypeId: docId,
                    source: "LENDER_ADDED",
                    isRequired: true,
                    status: "PENDING",
                    lastRequestedAt: new Date(),
                  },
                });
              }
            }

            // -------------------------------
            // 🔥 LENDER-SPECIFIC TRACKING (NEW)
            // -------------------------------
            const existingLenderRequests =
              await tx.lenderDocumentRequest.findMany({
                where: {
                  applicationLenderId,
                },
                select: { id: true, documentTypeId: true },
              });

            const lenderMap = new Map(
              existingLenderRequests.map((r) => [r.documentTypeId, r])
            );

            for (const docId of documentTypeIds) {
              const existing = lenderMap.get(docId);

              if (existing) {
                await tx.lenderDocumentRequest.update({
                  where: { id: existing.id },
                  data: {
                    status: "PENDING",
                    updatedAt: new Date(),
                  },
                });
              } else {
                await tx.lenderDocumentRequest.create({
                  data: {
                    loanApplicationId: record.loanApplicationId,
                    applicationLenderId,
                    documentTypeId: docId,
                    status: "PENDING",
                  },
                });
              }
            }

            // -------------------------------
            // TOKEN (UNCHANGED)
            // -------------------------------
            const token = crypto.randomBytes(32).toString("hex");

            const tokenRecord = await tx.clientUploadToken.create({
              data: {
                loanApplicationId: record.loanApplicationId,
                clientId: record.loanApplication.clientId,
                token,
                expiresAt: new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ),
              },
            });

            uploadToken = tokenRecord.token;

            if (previousLoanStatus !== "IN_REVIEW") {
              await tx.loanApplication.update({
                where: { id: record.loanApplicationId },
                data: { status: "IN_REVIEW" },
              });
            }
          }

          /* ===============================
             DECLINED FLOW (UNCHANGED)
          =============================== */
          if (decision === "DECLINED") {
            const remaining = await tx.applicationLender.count({
              where: {
                loanApplicationId: record.loanApplicationId,
                status: { notIn: ["DECLINED"] },
              },
            });

            if (remaining === 0) {
              await tx.loanApplication.update({
                where: { id: record.loanApplicationId },
                data: { status: "LENDER_DECLINED" },
              });
            }
          }
        });

        /* ===============================
           EMAIL NOTIFICATION (UNCHANGED)
        =============================== */
        if (decision === "CONDITIONAL" && uploadToken) {
          const uploadLink = `${process.env.FRONTEND_URL}/client-upload/${uploadToken}`;

          const html = loadTemplate("clientPortal/document", {
            clientName:
              record.loanApplication.client?.legalName || "Customer",
            uploadLink,
            applicationNumber:
              record.loanApplication.applicationNumber,
          });

          const subject =
            "Documents Required for Your Loan Application";

          const text = `Please upload required documents using this link: ${uploadLink}`;

          try {
            await sendEmailUsingKafka(clientEmail, subject, text, html);
          } catch (err) {
            await sendMail({
              to: clientEmail,
              subject,
              text,
              html,
            });
          }
        }

        return reply.send({
          success: true,
          message: `Application ${decision} processed successfully`,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "lender-decision",
        });

        return reply.status(500).send({
          success: false,
          message: "Server error while processing decision",
        });
      }
    }
  );
}

module.exports = lenderDecisionRoutes;