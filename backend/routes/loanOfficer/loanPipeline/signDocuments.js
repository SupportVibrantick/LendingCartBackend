const { extraOfficerPermission } = require("../../../services/broker/loanOfficerAccess");
const { isDynamicForm } = require("../../../utils/documents/signDocumentWorkflow");
const {
  buildSignDocumentDownload,
} = require("../../../services/documents/signForm/exportFilledForm.service");
const {
  listBrokerSignDocuments,
} = require("../../../utils/documents/listSignDocuments");
const {
  SIGN_REQUIREMENT_INCLUDE,
  listForwardableLendersForApplication,
  normalizeLenderIdList,
  sendSignRequirementToClient,
  forwardSignRequirementToLenders,
  uploadBrokerSignDocument,
  bulkSendSignDocumentsToClient,
  bulkForwardSignDocumentsToLenders,
  formatSignDocumentRequirement,
} = require("../../../services/documents/brokerSignDocumentActions.service");

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

        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) {
          return reply.code(403).send({
            success: false,
            message: accessError,
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

        const forwardableLenders = await listForwardableLendersForApplication(
          fastify.prisma,
          submission.application.id,
        );

        return reply.send({
          success: true,
          ...result,
          forwardableLenders,
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
    "/submissions/:submissionId/sign-documents",
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }
        const { submissionId } = req.params;
        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: { include: { client: { include: { contacts: true } } } } },
        });
        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) return reply.code(403).send({ success: false, message: accessError });

        const { requirement, autoPublish, message } = await uploadBrokerSignDocument(
          fastify.prisma,
          {
            submission,
            brokerOrgId: req.user.organizationId,
            userId: req.user.userId || req.user.id,
            parts: req.parts(),
            logger: fastify.log,
          },
        );

        return reply.send({
          success: true,
          message,
          data: formatSignDocumentRequirement(requirement, { viewer: "broker" }),
          autoPublish,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to upload sign document",
        });
      }
    },
  );

  fastify.post(
    "/submissions/:submissionId/sign-documents/bulk-send-to-client",
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }
        const { submissionId } = req.params;
        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: { include: { client: { include: { contacts: true } } } } },
        });
        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) return reply.code(403).send({ success: false, message: accessError });

        const results = await bulkSendSignDocumentsToClient(fastify.prisma, {
          submission,
          requirementIds: req.body?.requirementIds || [],
          brokerFirstName: req.user.firstName,
          io: fastify.io,
          logger: fastify.log,
        });

        return reply.send({
          success: true,
          message: `${results.length} document(s) sent to client`,
          data: results.map((item) => formatSignDocumentRequirement(item, { viewer: "broker" })),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to send documents to client",
        });
      }
    },
  );

  fastify.post(
    "/submissions/:submissionId/sign-documents/bulk-forward-to-lenders",
    { preHandler: signDocsGuard },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }
        const { submissionId } = req.params;
        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: { include: { client: { include: { contacts: true } } } } },
        });
        const accessError = assertLoanOfficerSubmissionAccess(req, submission);
        if (accessError) return reply.code(403).send({ success: false, message: accessError });

        const result = await bulkForwardSignDocumentsToLenders(fastify.prisma, {
          submission,
          requirementIds: req.body?.requirementIds || [],
          applicationLenderIds: req.body?.applicationLenderIds || [],
          io: fastify.io,
          logger: fastify.log,
        });

        return reply.send({ success: true, message: "Documents forwarded", data: result });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to forward documents",
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
            include: SIGN_REQUIREMENT_INCLUDE,
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        const updated = await sendSignRequirementToClient(fastify.prisma, {
          requirement,
          submission,
          brokerFirstName: req.user.firstName,
          io: fastify.io,
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
        return reply.code(error.statusCode || 500).send({
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
              uploads: { where: { isSignedOutput: true } },
              requestApplicationLender: true,
            },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        const applicationLenderIds = normalizeLenderIdList(
          req.body || {},
          requirement,
        );

        const { updated, forwardedCount, lenderNames } =
          await forwardSignRequirementToLenders(fastify.prisma, {
            requirement,
            submission,
            applicationLenderIds,
            io: fastify.io,
            logger: fastify.log,
          });

        const lenderLabel =
          lenderNames.length === 1
            ? lenderNames[0]
            : `${forwardedCount} lenders`;

        return reply.send({
          success: true,
          message: isDynamicForm(requirement)
            ? `Completed form forwarded to ${lenderLabel}`
            : `Signed document forwarded to ${lenderLabel}`,
          data: formatSignDocumentRequirement(updated, { viewer: "broker" }),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to forward signed document",
        });
      }
    },
  );

  fastify.get(
    "/submissions/:submissionId/sign-documents/:requirementId/download-filled",
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
