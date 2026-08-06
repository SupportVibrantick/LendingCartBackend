const sendMail = require("../../../services/emails/mail");
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/email/emailTemplateData");
const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../../../utils/documents/formatSignDocument");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/clientNotifications");
const {
  applyDocumentSendStatusUpdates,
} = require("../../../services/documents/applyDocumentSendStatusUpdates");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../../../utils/lender/lenderDocumentDelivery");
const { extraOfficerPermission } = require("../../../services/broker/loanOfficerAccess");

function assertLoanOfficerSubmissionAccess(req, submission) {
  const brokerOrgId = req.user.organizationId;

  if (!submission || submission.application.brokerOrgId !== brokerOrgId) {
    return "Access denied";
  }

  const userId = req.user.id || req.user.userId;
  if (submission.application.brokerUserId !== userId) {
    return "Access denied - not assigned to you";
  }

  return null;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function loanOfficerSignDocuments(fastify) {
  const signDocsGuard = extraOfficerPermission(fastify, "DOCUMENTS_TO_SIGN");

  fastify.get(
    "/submissions/:submissionId/sign-documents",
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) {
          return reply.code(403).send({
            success: false,
            message: accessError,
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
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

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

        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) {
          return reply.code(403).send({
            success: false,
            message: accessError,
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
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) {
          return reply.code(403).send({
            success: false,
            message: accessError,
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
