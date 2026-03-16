const crypto = require("crypto");

const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");
const { sendEmailUsingKafka } = require("../../../services/kafka/email/producer");

// const { lenderLogs } = require("../../../services/logger/contextLogger");

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
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ===============================
        // AUTH CHECK
        // ===============================

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
        const { decision, approvedAmount, interestRate, notes } = req.body;

        // ===============================
        // FETCH APPLICATION
        // ===============================

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

        // ===============================
        // EXTRACT CLIENT EMAIL
        // ===============================

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

        // ===============================
        // DECISION MAP
        // ===============================

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

        // ===============================
        // TRANSACTION
        // ===============================

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

          // ===============================
          // CONDITIONAL FLOW
          // ===============================

          if (decision === "CONDITIONAL") {

            const lenderRequirements =
              await tx.lenderDocumentRequirement.findMany({
                where: { lenderProductId: record.lenderProductId },
              });

            const existingRequirements =
              await tx.applicationDocumentRequirement.findMany({
                where: {
                  loanApplicationId: record.loanApplicationId,
                },
                select: { documentTypeId: true },
              });

            const existingDocIds = new Set(
              existingRequirements.map((r) => r.documentTypeId)
            );

            const newRequirements = lenderRequirements
              .filter((req) => !existingDocIds.has(req.documentTypeId))
              .map((req) => ({
                loanApplicationId: record.loanApplicationId,
                documentTypeId: req.documentTypeId,
                source: "LENDER_DEFAULT",
                isRequired: req.isRequired,
                status: "PENDING",
              }));

            if (newRequirements.length > 0) {
              await tx.applicationDocumentRequirement.createMany({
                data: newRequirements,
              });
            }

            // ALWAYS create upload token
            const token = crypto.randomBytes(32).toString("hex");

            const tokenRecord = await tx.clientUploadToken.create({
              data: {
                loanApplicationId: record.loanApplicationId,
                clientId: record.loanApplication.clientId,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

          // ===============================
          // DECLINED FLOW
          // ===============================

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

        // ===============================
        // EMAIL NOTIFICATION
        // ===============================

        if (decision === "CONDITIONAL" && uploadToken) {

          const uploadLink =
            `${process.env.FRONTEND_URL}/client-upload/${uploadToken}`;

          const html = loadTemplate("clientPortal/document", {
            clientName:
              record.loanApplication.client?.legalName || "Customer",
            uploadLink,
            applicationNumber:
              record.loanApplication.applicationNumber,
          });

          const subject = "Documents Required for Your Loan Application";

          const text =
            `Please upload required documents using this link: ${uploadLink}`;

          try {
            await sendEmailUsingKafka(clientEmail, subject, text, html);
          } catch (err) {

            // lenderLogs.error("Kafka email failed, fallback SMTP", err);

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

        // lenderLogs.error("Decision API failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while processing decision",
        });
      }
    }
  );
}

module.exports = lenderDecisionRoutes;