const sendMail = require("../../../services/mail");
const { loadTemplate } = require("../../../utils/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/emailTemplateData");
const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../../../utils/formatSignDocument");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/clientNotifications");
const {
  applyDocumentSendStatusUpdates,
} = require("../../../services/applyDocumentSendStatusUpdates");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../../../utils/lenderDocumentDelivery");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function brokerSignDocuments(fastify) {
  fastify.get(
    "/submissions/:submissionId/sign-documents",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { submissionId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        if (!submission || submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const requirements =
          await fastify.prisma.applicationDocumentRequirement.findMany({
            where: {
              loanApplicationId: submission.application.id,
              requiresClientSignature: true,
            },
            include: {
              documentType: true,
              uploads: {
                where: { isSignedOutput: true },
                orderBy: { uploadedAt: "desc" },
              },
              requestApplicationLender: {
                include: REQUEST_APPLICATION_LENDER_INCLUDE,
              },
            },
            orderBy: { createdAt: "desc" },
          });

        return reply.send({
          success: true,
          data: requirements.map((item) =>
            formatSignDocumentRequirement(item, { viewer: "broker" }),
          ),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load sign documents",
        });
      }
    },
  );

  fastify.post(
    "/submissions/:submissionId/sign-documents/:requirementId/send-to-client",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { submissionId, requirementId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: {
            application: {
              include: {
                client: { include: { contacts: true } },
              },
            },
          },
        });

        if (!submission || submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findFirst({
            where: {
              id: requirementId,
              loanApplicationId: submission.application.id,
              requiresClientSignature: true,
            },
            include: {
              documentType: true,
              uploads: { where: { isSignedOutput: true } },
              requestApplicationLender: {
                include: REQUEST_APPLICATION_LENDER_INCLUDE,
              },
            },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (!requirement.templateFileUrl) {
          return reply.code(400).send({
            success: false,
            message: "Template file missing for this document",
          });
        }

        if (
          requirement.signStatus === "CLIENT_SIGNED" ||
          requirement.signStatus === "FORWARDED_TO_LENDER"
        ) {
          return reply.code(400).send({
            success: false,
            message: "Document already signed by client",
          });
        }

        const updated = await fastify.prisma.applicationDocumentRequirement.update({
          where: { id: requirement.id },
          data: {
            signStatus: "SENT_TO_CLIENT",
            sentToClientAt: new Date(),
            status: "PENDING",
          },
          include: {
            documentType: true,
            uploads: { where: { isSignedOutput: true } },
            requestApplicationLender: {
              include: REQUEST_APPLICATION_LENDER_INCLUDE,
            },
          },
        });

        const client = submission.application.client;
        const contact =
          client?.contacts?.find((item) => item.isPrimary && item.email) ||
          client?.contacts?.find((item) => item.email);
        const clientEmail = contact?.email;

        if (client?.id) {
          await notifyClient(fastify.prisma, fastify.io, {
            clientId: client.id,
            eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
            category: "DOCUMENTS",
            subject: "Document signature required",
            body: `Please review and sign: ${requirement.documentType?.name || "Document"}`,
            metadata: {
              loanApplicationId: submission.application.id,
              requirementId: requirement.id,
              signDocument: true,
            },
          });
        }

        if (clientEmail) {
          const portalLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/client-portal`;
          const html = loadTemplate(
            "broker/clientLink",
            buildClientLinkEmailData({
              clientName: client?.legalName,
              uploadLink: portalLink,
              applicationNumber: submission.application.applicationNumber,
              brokerName: req.user.firstName,
              message: `Please sign the requested document: ${requirement.documentType?.name || "Document"}`,
              preset: "signatureRequired",
            }),
          );

          try {
            await sendMail({
              to: clientEmail,
              subject: "Signature required for your loan documents",
              html,
            });
          } catch (mailErr) {
            fastify.log.warn({ error: mailErr.message }, "Sign doc email failed");
          }
        }

        return reply.send({
          success: true,
          message: "Sign document sent to client",
          data: formatSignDocumentRequirement(updated, { viewer: "broker" }),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to send sign document",
        });
      }
    },
  );

  fastify.post(
    "/submissions/:submissionId/sign-documents/:requirementId/forward-to-lender",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { submissionId, requirementId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        if (!submission || submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findFirst({
            where: {
              id: requirementId,
              loanApplicationId: submission.application.id,
              requiresClientSignature: true,
            },
            include: {
              documentType: true,
              uploads: { where: { isSignedOutput: true }, take: 1 },
              requestApplicationLender: true,
            },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (requirement.signStatus !== "CLIENT_SIGNED") {
          return reply.code(400).send({
            success: false,
            message: "Client must sign the document before forwarding",
          });
        }

        const signedUpload = requirement.uploads?.[0];
        if (!signedUpload) {
          return reply.code(400).send({
            success: false,
            message: "Signed file not found",
          });
        }

        const applicationLenderId = requirement.requestApplicationLenderId;
        if (!applicationLenderId) {
          return reply.code(400).send({
            success: false,
            message: "Requesting lender not found",
          });
        }

        const lender = await fastify.prisma.applicationLender.findUnique({
          where: { id: applicationLenderId },
        });

        if (!lender || lender.loanApplicationId !== submission.application.id) {
          return reply.code(400).send({
            success: false,
            message: "Invalid lender for this application",
          });
        }

        if (!canLenderReceiveDocuments(lender.status)) {
          return reply.code(400).send({
            success: false,
            message: getLenderDocumentDeliveryBlockMessage(lender.status),
          });
        }

        await fastify.prisma.applicationDocumentSubmission.createMany({
          data: [
            {
              documentUploadId: signedUpload.id,
              applicationLenderId,
            },
          ],
          skipDuplicates: true,
        });

        await fastify.prisma.applicationDocumentUpload.update({
          where: { id: signedUpload.id },
          data: {
            isSubmittedToLender: true,
            submittedAt: new Date(),
          },
        });

        const updated = await fastify.prisma.applicationDocumentRequirement.update({
          where: { id: requirement.id },
          data: {
            signStatus: "FORWARDED_TO_LENDER",
            status: "COMPLETE",
          },
          include: {
            documentType: true,
            uploads: { where: { isSignedOutput: true } },
            requestApplicationLender: {
              include: REQUEST_APPLICATION_LENDER_INCLUDE,
            },
          },
        });

        await applyDocumentSendStatusUpdates(fastify.prisma, {
          loanApplicationId: submission.application.id,
          applicationLenderIds: [applicationLenderId],
        });

        return reply.send({
          success: true,
          message: "Signed document forwarded to lender",
          data: formatSignDocumentRequirement(updated, { viewer: "broker" }),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to forward signed document",
        });
      }
    },
  );
};
