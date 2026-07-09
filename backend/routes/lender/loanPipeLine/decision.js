const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/email/emailTemplateData");
const { buildClientPortalUrl } = require("../../../utils/email/emailBranding");
const sendMail = require("../../../services/emails/mail");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/clientNotifications");

const INTEREST_RATE_MAX = 100;
const APPROVED_AMOUNT_MAX = 999_999_999_999_999.99;

function parseApprovedAmount(value) {
  if (value == null || value === "") return null;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("Approved amount must be a valid number");
  }
  if (num < 0) {
    throw new Error("Approved amount cannot be negative");
  }
  if (num > APPROVED_AMOUNT_MAX) {
    throw new Error("Approved amount is too large");
  }

  return Math.round(num * 100) / 100;
}

function parseInterestRate(value) {
  if (value == null || value === "") return null;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("Interest rate must be a valid number");
  }
  if (num < 0 || num > INTEREST_RATE_MAX) {
    throw new Error(
      `Interest rate must be between 0 and ${INTEREST_RATE_MAX} (enter as a percentage, e.g. 8.5 for 8.5%)`,
    );
  }

  return Math.round(num * 10000) / 10000;
}

function isClientError(message = "") {
  return /must be|cannot be|too large|Please select/i.test(message);
}

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
            approvedAmount: { type: "number", minimum: 0 },
            interestRate: { type: "number", minimum: 0, maximum: 100 },
            notes: { type: "string" },
            documentTypeIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            customDocuments: {
              type: "array",
              items: { type: "string" },
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
          customDocuments,
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
            lender: {
              select: { name: true },
            },
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
            (f) => f.fieldKey === "email",
          );

          if (emailField) {
            clientEmail = emailField.value;
            break;
          }
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
        const normalizedApprovedAmount =
          decision === "APPROVED" ? parseApprovedAmount(approvedAmount) : null;
        const normalizedInterestRate =
          decision === "APPROVED" ? parseInterestRate(interestRate) : null;

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
              approvedAmount: normalizedApprovedAmount,
              interestRate: normalizedInterestRate,
              notes: notes || null,
            },
          });

          /* ===============================
             CONDITIONAL FLOW
          =============================== */
          if (decision === "CONDITIONAL") {
            const existingDocTypeIds = Array.isArray(documentTypeIds)
              ? documentTypeIds
              : [];

            const customDocNames = Array.isArray(customDocuments)
              ? customDocuments
              : [];

            if (
              existingDocTypeIds.length === 0 &&
              customDocNames.length === 0
            ) {
              throw new Error("Please select at least one document");
            }

            const createdCustomDocIds = [];

            for (const docName of customDocNames) {
              if (!docName?.trim()) continue;

              const existingCustomDoc = await tx.documentType.findFirst({
                where: {
                  name: docName.trim(),
                },
              });

              // already exists
              if (existingCustomDoc) {
                createdCustomDocIds.push(existingCustomDoc.id);
                continue;
              }

              // create new custom document
              const createdDoc = await tx.documentType.create({
                data: {
                  name: docName.trim(),

                  code: `CUSTOM_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 8)}`,

                  isCustom: true,
                  createdByOrgId: lenderOrgId,
                  isActive: true,
                },
              });

              createdCustomDocIds.push(createdDoc.id);
            }

            const finalDocumentTypeIds = [
              ...existingDocTypeIds,
              ...createdCustomDocIds,
            ];

            const existingRequirements =
              await tx.applicationDocumentRequirement.findMany({
                where: {
                  loanApplicationId: record.loanApplication.id,
                },
                select: { id: true, documentTypeId: true },
              });

            const existingMap = new Map(
              existingRequirements.map((r) => [r.documentTypeId, r]),
            );

            for (const docId of finalDocumentTypeIds) {
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
                    loanApplicationId: record.loanApplication.id,
                    documentTypeId: docId,
                    source: "LENDER_ADDED",
                    isRequired: true,
                    status: "PENDING",
                    lastRequestedAt: new Date(),
                  },
                });
              }
            }

            /* ===============================
               LENDER-SPECIFIC TRACKING
            =============================== */
            for (const docId of finalDocumentTypeIds) {
              await tx.lenderDocumentRequest.upsert({
                where: {
                  applicationLenderId_documentTypeId: {
                    applicationLenderId,
                    documentTypeId: docId,
                  },
                },
                update: {
                  status: "PENDING",
                  updatedAt: new Date(),
                },
                create: {
                  loanApplicationId: record.loanApplication.id,
                  applicationLenderId,
                  documentTypeId: docId,
                  status: "PENDING",
                },
              });
            }

            if (previousLoanStatus !== "IN_REVIEW") {
              await tx.loanApplication.update({
                where: { id: record.loanApplication.id },
                data: { status: "IN_REVIEW" },
              });
            }
          }

          /* ===============================
             APPROVED FLOW
             Keep application open for other lenders until broker marks funded.
          =============================== */
          if (decision === "APPROVED") {
            const currentStatus = record.loanApplication.status;
            if (!["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(currentStatus)) {
              await tx.loanApplication.update({
                where: { id: record.loanApplication.id },
                data: { status: "IN_REVIEW" },
              });
            }
          }

          /* ===============================
             DECLINED FLOW
          =============================== */
          if (decision === "DECLINED") {
            const remaining = await tx.applicationLender.count({
              where: {
                loanApplicationId: record.loanApplication.id,
                status: { notIn: ["DECLINED"] },
              },
            });

            if (remaining === 0) {
              await tx.loanApplication.update({
                where: { id: record.loanApplication.id },
                data: { status: "LENDER_DECLINED" },
              });
            }
          }
        });

        /* ===============================
           OPTIONAL EMAIL (NO TOKEN NOW)
        =============================== */
        if (decision === "CONDITIONAL" && clientEmail) {
          const html = loadTemplate(
            "clientPortal/document",
            buildClientLinkEmailData({
              clientName: record.loanApplication.client?.legalName,
              applicationNumber: record.loanApplication.applicationNumber,
              uploadLink: buildClientPortalUrl(),
              message:
                "The lender has requested additional documents to continue processing your application.",
              preset: "lenderConditional",
              brokerName: "Your Broker",
            }),
          );

          const subject = "Documents Required for Your Loan Application";
          const text = `Additional documents are required. Please contact your broker.`;

          try {
            await sendMail({
              prisma,
              to: clientEmail,
              subject,
              text,
              html,
              idempotencyKey: `lender-conditional:${record.id}`,
            });
          } catch (err) {
            fastify.log.error(err, "Failed to enqueue conditional decision email");
          }
        }

        const lenderName = record.lender?.name || "Lender";
        const applicationNumber = record.loanApplication.applicationNumber;
        const brokerOrgId = record.loanApplication.brokerOrgId;

        const decisionEventMap = {
          APPROVED: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_APPROVED,
          DECLINED: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_DECLINED,
          CONDITIONAL: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_CONDITIONAL,
        };

        const decisionBodyMap = {
          APPROVED: `${lenderName} approved application ${applicationNumber}`,
          DECLINED: `${lenderName} declined application ${applicationNumber}`,
          CONDITIONAL: `${lenderName} requested additional documents for application ${applicationNumber}`,
        };

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId,
          eventType: decisionEventMap[decision],
          category: "LENDER",
          subject: `Lender Decision: ${decision}`,
          body: decisionBodyMap[decision],
          metadata: {
            applicationId: record.loanApplication.id,
            applicationNumber,
            applicationLenderId,
            lenderName,
            decision,
            approvedAmount: normalizedApprovedAmount,
            interestRate: normalizedInterestRate,
          },
        });

        const clientId = record.loanApplication.clientId;
        if (clientId) {
          const clientEventMap = {
            APPROVED: CLIENT_NOTIFICATION_EVENTS.LENDER_APPROVED,
            DECLINED: CLIENT_NOTIFICATION_EVENTS.LENDER_DECLINED,
            CONDITIONAL: CLIENT_NOTIFICATION_EVENTS.LENDER_CONDITIONAL,
          };

          const clientBodyMap = {
            APPROVED: `Your application ${applicationNumber} has been approved by ${lenderName}.`,
            DECLINED: `Your application ${applicationNumber} was declined by ${lenderName}.`,
            CONDITIONAL: `${lenderName} requested additional documents for application ${applicationNumber}.`,
          };

          await notifyClient(prisma, fastify.io, {
            clientId,
            eventType: clientEventMap[decision],
            category: "APPLICATION",
            subject: clientBodyMap[decision],
            body: clientBodyMap[decision],
            metadata: {
              applicationId: record.loanApplication.id,
              applicationNumber,
              applicationLenderId,
              lenderName,
              decision,
            },
          });
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

        return reply.status(isClientError(error.message) ? 400 : 500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
}

module.exports = lenderDecisionRoutes;
