const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/email/emailTemplateData");

const sendMail = require("../../../services/emails/mail");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function subBrokerRequestDocumentsRoute(fastify) {
  fastify.post(
    "/:loanId/request-documents",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker -> Request Documents"],

        summary: "Request documents from client",

        params: {
          type: "object",

          required: ["loanId"],

          properties: {
            loanId: {
              type: "string",
            },
          },
        },

        body: {
          type: "object",

          required: ["documentTypeIds"],

          properties: {
            documentTypeIds: {
              type: "array",

              items: {
                type: "string",

                format: "uuid",
              },
            },

            message: {
              type: "string",
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

        if (!req.user || !req.user.userId) {
          return reply.code(401).send({
            success: false,

            message: "Unauthorized access",
          });
        }

        const userId = req.user.userId;

        const subBroker = await prisma.userAccount.findUnique({
          where: {
            id: userId,
          },

          select: {
            firstName: true,
            lastName: true,
          },
        });

        const actorName =
          `${subBroker?.firstName || ""} ${subBroker?.lastName || ""}`.trim() ||
          "Sub Broker";

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

        const uniqueDocIds = [...new Set(documentTypeIds)];

        /* ===============================
           VERIFY ASSIGNED APPLICATION
        =============================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            subBrokerId: userId,

            loanApplicationId: loanId,
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,

            message: "Access denied. Application not assigned.",
          });
        }

        /* ===============================
           FETCH LOAN + CLIENT
        =============================== */

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanId,
          },

          include: {
            client: {
              include: {
                contacts: true,
              },
            },
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,

            message: "Loan application not found",
          });
        }

        /* ===============================
           GET CLIENT EMAIL
        =============================== */

        const contact =
          loan.client.contacts.find((c) => c.isPrimary && c.email) ||
          loan.client.contacts.find((c) => c.email);

        const clientEmail = contact?.email;

        if (!clientEmail) {
          return reply.code(400).send({
            success: false,

            message: "Client email not available",
          });
        }

        /* ===============================
           SOURCE
        =============================== */

        const source = "SUB_BROKER_ADDED";

        /* ===============================
           TRANSACTION
        =============================== */

        await prisma.$transaction(async (tx) => {
          const existingDocs = await tx.applicationDocumentRequirement.findMany(
            {
              where: {
                loanApplicationId: loan.id,
              },
            },
          );

          for (const docTypeId of uniqueDocIds) {
            const existing = existingDocs.find(
              (d) => d.documentTypeId === docTypeId && d.source === source,
            );

            if (existing) {
              /* RE-REQUEST */

              await tx.applicationDocumentRequirement.update({
                where: {
                  id: existing.id,
                },

                data: {
                  status: "PENDING",

                  lastRequestedAt: new Date(),

                  requestedBySubBrokerId: userId,

                  updatedAt: new Date(),
                },
              });
            } else {
              /* NEW REQUEST */

              await tx.applicationDocumentRequirement.create({
                data: {
                  loanApplicationId: loan.id,

                  documentTypeId: docTypeId,

                  source,

                  isRequired: true,

                  status: "PENDING",

                  lastRequestedAt: new Date(),

                  requestedBySubBrokerId: userId,
                },
              });
            }
          }
        });

        /* ===============================
           EMAIL TEMPLATE
        =============================== */

        const portalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/client-portal`;

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

        /* ===============================
           SEND EMAIL
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

              requestedBy: "SUB_BROKER",
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

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,

          message: "Documents requested successfully",
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,

            loanId: req.params.loanId,

            userId: req.user?.userId,
          },

          "Document request failed",
        );

        return reply.code(500).send({
          success: false,

          message: error.message || "Unexpected server error",
        });
      }
    },
  );
}

module.exports = subBrokerRequestDocumentsRoute;
