const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/clientNotifications");
const {
  canBrokerRequestDocuments,
} = require("../../../utils/resolveApplicationStatus");

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

        if (!clientEmail) {
          return reply.code(400).send({
            success: false,
            message: "Client email not available",
          });
        }

        /* ===============================
           DETERMINE SOURCE
        =============================== */

        const source =
          req.user.orgType === "BROKER"
            ? "BROKER_ADDED"
            : "LENDER_ADDED";

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
                },
              });
            }
          }
        });

        /* ===============================
           EMAIL PREPARATION
        =============================== */

        const portalLink = `${process.env.FRONTEND_URL}/client`;

        const html = loadTemplate("broker/clientLink", {
          clientName: loan.client?.legalName || "Customer",
          uploadLink: portalLink,
          applicationNumber: loan.applicationNumber,
          brokerName: actorName,
          message:
            message ||
            "New documents have been requested for your application.",
        });

        const subject = "Document Request Update for Your Loan";

        const text = `
Hello,

There is an update regarding your document requirements.

Please login here:
${portalLink}
        `;

        /* ===============================
           SEND EMAIL (NON-BLOCKING SAFE)
        =============================== */

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
            "Document request email sent"
          );
        } catch (err) {
          // 🔥 Do NOT fail entire request if email fails
          fastify.log.error(
            {
              error: err.message,
              clientEmail,
              loanId,
            },
            "Email sending failed"
          );
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        if (loan.clientId) {
          await notifyClient(prisma, fastify.io, {
            clientId: loan.clientId,
            eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
            category: "DOCUMENT",
            subject: "Documents requested",
            body: `New documents have been requested for application ${loan.applicationNumber}.`,
            metadata: {
              applicationId: loan.id,
              applicationNumber: loan.applicationNumber,
              documentCount: uniqueDocIds.length,
              requestedBy: req.user.orgType,
            },
          });
        }

        return reply.send({
          success: true,
          message: "Documents requested successfully",
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
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = requestDocumentsRoute;