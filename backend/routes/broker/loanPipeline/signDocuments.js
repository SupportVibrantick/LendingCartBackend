const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../../../utils/documents/formatSignDocument");
const {
  applyDocumentSendStatusUpdates,
} = require("../../../services/documents/applyDocumentSendStatusUpdates");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../../../utils/lender/lenderDocumentDelivery");
const {
  notifyClientSignDocumentRequested,
  notifyLenderSignedDocumentForwarded,
} = require("../../../services/documents/signForm/signDocumentNotify");
const { isDynamicForm } = require("../../../utils/documents/signDocumentWorkflow");
const {
  buildSignDocumentDownload,
} = require("../../../services/documents/signForm/exportFilledForm.service");
const {
  listBrokerSignDocuments,
} = require("../../../utils/documents/listSignDocuments");

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
        const { page = 1, limit = 9, search = "", lenderId = "" } = req.query;
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(limit, 10) || 9, 1), 50);
        const searchTerm =
          typeof search === "string" ? search.trim() : "";
        const lenderFilter =
          typeof lenderId === "string" ? lenderId.trim() : "";

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

        const result = await listBrokerSignDocuments(fastify.prisma, {
          loanApplicationId: submission.application.id,
          pageNumber,
          pageSize,
          searchTerm,
          lenderId: lenderFilter,
          viewer: "broker",
        });

        return reply.send({
          success: true,
          ...result,
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
          requirement.signMode === "DYNAMIC_FORM" &&
          !requirement.activeFormVersionId
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Lender must publish fillable form fields before sending to client",
          });
        }

        if (
          requirement.signStatus === "FORWARDED_TO_LENDER" ||
          requirement.signStatus === "LENDER_SEEN"
        ) {
          return reply.code(400).send({
            success: false,
            message: "Document already forwarded to lender",
          });
        }

        // Allow re-opening a prematurely finalized DYNAMIC_FORM for the client.
        if (
          requirement.signStatus === "CLIENT_SIGNED" &&
          requirement.signMode === "DYNAMIC_FORM"
        ) {
          await fastify.prisma.$transaction(async (tx) => {
            await tx.applicationDocumentUpload.deleteMany({
              where: {
                documentRequirementId: requirement.id,
                isSignedOutput: true,
              },
            });
            await tx.signFormSubmission.updateMany({
              where: { requirementId: requirement.id },
              data: {
                status: "DRAFT",
                submittedAt: null,
              },
            });
          });
        }

        const updated = await fastify.prisma.applicationDocumentRequirement.update({
          where: { id: requirement.id },
          data: {
            signStatus: "SENT_TO_CLIENT",
            sentToClientAt: new Date(),
            status: "PENDING",
            clientSignedAt: null,
          },
          include: {
            documentType: true,
            uploads: { where: { isSignedOutput: true } },
            requestApplicationLender: {
              include: REQUEST_APPLICATION_LENDER_INCLUDE,
            },
            activeFormVersion: true,
            signFormSubmissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { values: true },
            },
          },
        });

        const client = submission.application.client;
        await notifyClientSignDocumentRequested({
          prisma: fastify.prisma,
          io: fastify.io,
          requirement,
          client,
          application: submission.application,
          brokerFirstName: req.user.firstName,
          logger: fastify.log,
        });

        return reply.send({
          success: true,
          message:
            requirement.signMode === "DYNAMIC_FORM"
              ? "Fillable form sent to client"
              : "Sign document sent to client",
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
            message:
              requirement.signMode === "DYNAMIC_FORM"
                ? "Form must be fully completed by client and broker before forwarding"
                : "Client must sign the document before forwarding",
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

        await notifyLenderSignedDocumentForwarded({
          prisma: fastify.prisma,
          io: fastify.io,
          applicationLenderId,
          loanApplicationId: submission.application.id,
          applicationNumber: submission.application.applicationNumber,
          documentTypeName:
            requirement.signDocumentTitle ||
            requirement.documentType?.name ||
            "Signed document",
          isForm: isDynamicForm(requirement),
        });

        return reply.send({
          success: true,
          message: isDynamicForm(requirement)
            ? "Completed form forwarded to lender"
            : "Signed document forwarded to lender",
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

  fastify.get(
    "/submissions/:submissionId/sign-documents/:requirementId/download-filled",
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
            select: { id: true },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        const file = await buildSignDocumentDownload(
          fastify.prisma,
          requirementId,
        );

        return reply
          .header("Content-Type", file.mimeType)
          .header(
            "Content-Disposition",
            `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
          )
          .send(file.buffer);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to download filled form",
        });
      }
    },
  );
};
