const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function requestDocumentsRoute(fastify) {
  fastify.post(
    "/:loanId/request-documents",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Broker requests documents from client",
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
          req.user.orgType !== "BROKER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const brokerName =
          req.user.firstName || "Your Broker";

        const { loanId } = req.params;
        const { documentTypeIds, message } = req.body;

        if (!documentTypeIds || documentTypeIds.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Please select at least one document",
          });
        }

        /* ===============================
           FETCH LOAN + CLIENT
        =============================== */

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanId,
            brokerOrgId,
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
          loan.client.contacts.find(
            (c) => c.isPrimary && c.email
          ) || loan.client.contacts.find((c) => c.email);

        const clientEmail = contact?.email;

        if (!clientEmail) {
          return reply.code(400).send({
            success: false,
            message: "Client email not found",
          });
        }

        /* ===============================
           CREATE DOCUMENT REQUIREMENTS
        =============================== */

        await prisma.$transaction(async (tx) => {
          const existingDocs =
            await tx.applicationDocumentRequirement.findMany({
              where: {
                loanApplicationId: loan.id,
              },
              select: { documentTypeId: true },
            });

          const existingSet = new Set(
            existingDocs.map((d) => d.documentTypeId)
          );

          const newDocs = documentTypeIds
            .filter((id) => !existingSet.has(id))
            .map((id) => ({
              loanApplicationId: loan.id,
              documentTypeId: id,
              source: "BROKER_ADDED", // 🔥 important
              isRequired: true,
              status: "PENDING",
            }));

          if (newDocs.length > 0) {
            await tx.applicationDocumentRequirement.createMany({
              data: newDocs,
            });
          }
        });

        /* ===============================
           EMAIL LINK (NO NEW TOKEN)
        =============================== */

        const portalLink = `${process.env.FRONTEND_URL}/client`;

        /* ===============================
           EMAIL TEMPLATE
        =============================== */

        const html = loadTemplate("broker/clientLink", {
          clientName: loan.client?.legalName || "Customer",
          uploadLink: portalLink,
          applicationNumber: loan.applicationNumber,
          brokerName,
          message:
            message || "New documents have been requested for your application.",
        });

        const subject = "New Documents Requested for Your Loan";

        const text = `
Hello,

Your broker has requested additional documents.

Login here:
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
            { clientEmail, loanId },
            "Document request email sent"
          );
        } catch (err) {
          fastify.log.error(
            {
              error: err.message,
              clientEmail,
              loanId,
            },
            "Email sending failed"
          );

          return reply.code(500).send({
            success: false,
            message: "Failed to send email",
          });
        }

        /* ===============================
           RESPONSE
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
            brokerOrgId: req.user?.organizationId,
          },
          "Broker document request failed"
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