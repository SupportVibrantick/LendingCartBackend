
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/clientNotifications");
const {
  canBrokerRequestDocuments,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  getAutoForwardLenderRequestsToClient,
} = require("../../../services/documents/documentAutoForwardSetting");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const { buildClientPortalUrl } = require("../../../utils/email/emailBranding");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function requestDocumentsRoute(fastify) {
  fastify.post(
    "/:loanId/request-documents",
    {
      schema: {
        tags: ["Loan Pipeline"],
        summary: "Request documents from client (Broker / Lender)",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["documentTypeIds"],
          properties: {
            documentTypeIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            message: { type: "string" },
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
          !req.user.organizationId ||
          !["BROKER", "LENDER"].includes(req.user.orgType)
        ) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        const orgId = req.user.organizationId;
        const actorName = req.user.firstName || "Team";

        const { loanId } = req.params;
        const { documentTypeIds, message } = req.body;

        /* ===============================
           VALIDATION
        =============================== */

        if (!Array.isArray(documentTypeIds) || documentTypeIds.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Please provide at least one document type",
          });
        }

        // Remove duplicates from input
        const uniqueDocIds = [...new Set(documentTypeIds)];

        /* ===============================
           FETCH LOAN + CLIENT
        =============================== */

        const loan = await prisma.loanApplication.findFirst({
          where:
            req.user.orgType === "BROKER"
              ? { id: loanId, brokerOrgId: orgId }
              : {
                  id: loanId,
                  applicationLenders: {
                    some: {
                      lenderOrgId: orgId,
                    },
                  },
                },
          include: {
            client: {
              include: {
                contacts: true,
              },
            },
            applicationLenders: {
              select: { status: true },
            },
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found or access denied",
          });
        }

        const requestCheck = canBrokerRequestDocuments(loan);

        if (!requestCheck.allowed) {
          return reply.code(400).send({
            success: false,
            message: requestCheck.reason,
          });
        }

        /* ===============================
           GET CLIENT EMAIL
        =============================== */

        const contact =
          loan.client.contacts.find(
            (c) => c.isPrimary && c.email
          ) || loan.client.contacts.find((c) => c.email);

        const clientEmail = contact?.email;

        const source =
          req.user.orgType === "BROKER"
            ? "BROKER_ADDED"
            : "LENDER_ADDED";

        const autoForwardLenderRequestsToClient =
          source === "LENDER_ADDED"
            ? await getAutoForwardLenderRequestsToClient(prisma, loan.id)
            : false;
        const sentToClientAt =
          source === "LENDER_ADDED" && autoForwardLenderRequestsToClient
            ? new Date()
            : null;
        const shouldNotifyClient = Boolean(sentToClientAt);

        if (shouldNotifyClient && !clientEmail) {
          return reply.code(400).send({
            success: false,
            message: "Client email not available",
          });
        }

        /* ===============================
           TRANSACTION: UPSERT LOGIC
        =============================== */

        await prisma.$transaction(async (tx) => {
          const existingDocs =
            await tx.applicationDocumentRequirement.findMany({
              where: {
                loanApplicationId: loan.id,
              },
            });

          for (const docTypeId of uniqueDocIds) {
            const existing = existingDocs.find(
              (d) => d.documentTypeId === docTypeId
            );

            if (existing) {
              // 🔁 RE-REQUEST
              await tx.applicationDocumentRequirement.update({
                where: { id: existing.id },
                data: {
                  status: "PENDING",
                  lastRequestedAt: new Date(),
                  updatedAt: new Date(),
                  ...(source === "LENDER_ADDED" && sentToClientAt
                    ? { sentToClientAt }
                    : {}),
                },
              });
            } else {
              // 🆕 NEW REQUEST
              await tx.applicationDocumentRequirement.create({
                data: {
                  loanApplicationId: loan.id,
                  documentTypeId: docTypeId,
                  source,
                  isRequired: true,
                  status: "PENDING",
                  lastRequestedAt: new Date(),
                  ...(sentToClientAt ? { sentToClientAt } : {}),
                },
              });
            }
          }
        });

        /* ===============================
           EMAIL / NOTIFY CLIENT (broker requests, or lender + auto-forward)
        =============================== */

        if (shouldNotifyClient) {
          const portalLink = buildClientPortalUrl({ path: "/client-portal" });

          const html = loadTemplate(
            "broker/clientLink",
            buildClientLinkEmailData({
              clientName: loan.client?.legalName,
              uploadLink: portalLink,
              applicationNumber: loan.applicationNumber,
              brokerName: actorName,
              message:
                message ||
                "New documents have been requested for your application.",
              preset: "documentsRequested",
            }),
          );

          const subject = "Document Request Update for Your Loan";

          const text = `
Hello,

There is an update regarding your document requirements.

Please login here:
${portalLink}
        `;

          try {
            await sendMail({
              to: clientEmail,
              subject,
              text,
              html,
            });

            fastify.log.info(
              {
                clientEmail,
                loanId,
                requestedBy: req.user.orgType,
              },
              "Document request email sent",
            );
          } catch (err) {
            fastify.log.error(
              {
                error: err.message,
                clientEmail,
                loanId,
              },
              "Email sending failed",
            );
          }

          try {
            await notifyClient(prisma, fastify.io, {
              clientId: loan.clientId,
              eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
              category: "DOCUMENT",
              subject: `Documents requested for ${loan.applicationNumber}`,
              body:
                message ||
                "New documents have been requested for your application.",
              metadata: {
                applicationId: loan.id,
                applicationNumber: loan.applicationNumber,
              },
            });
          } catch (err) {
            fastify.log.error(err, "Client notification failed");
          }
        } else if (source === "LENDER_ADDED") {
          // Lender request held at broker — notify broker only
          try {
            await notifyBroker(prisma, fastify.io, {
              brokerOrgId: loan.brokerOrgId,
              eventType: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_CONDITIONAL,
              category: "LENDER",
              subject: "Lender requested documents",
              body: `A lender requested ${uniqueDocIds.length} document(s) for application ${loan.applicationNumber}. Forward them to the client when ready.`,
              metadata: {
                applicationId: loan.id,
                applicationNumber: loan.applicationNumber,
                documentCount: uniqueDocIds.length,
              },
            });
          } catch (err) {
            fastify.log.error(err, "Broker notification failed");
          }
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,
          message: shouldNotifyClient
            ? "Documents requested and client notified"
            : "Documents requested. Broker can forward them to the client.",
          data: {
            forwardedToClient: shouldNotifyClient,
            documentCount: uniqueDocIds.length,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            loanId: req.params.loanId,
            orgId: req.user?.organizationId,
          },
          "Document request failed"
        );

        return reply.code(500).send({
          success: false,
          message: error.message ||"Unexpected server error",
        });
      }
    }
  );
}

module.exports = requestDocumentsRoute;