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

async function loadBrokerSubmission(prisma, submissionId, brokerOrgId) {
  const submission = await prisma.applicationSubmission.findUnique({
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
    return null;
  }

  return submission;
}

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

        const [result, forwardableLenders] = await Promise.all([
          listBrokerSignDocuments(fastify.prisma, {
            loanApplicationId: submission.application.id,
            pageNumber,
            pageSize,
            searchTerm,
            lenderId: lenderFilter,
            viewer: "broker",
          }),
          listForwardableLendersForApplication(
            fastify.prisma,
            submission.application.id,
          ),
        ]);

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
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.userId || req.user.id;
        const { submissionId } = req.params;

        const submission = await loadBrokerSubmission(
          fastify.prisma,
          submissionId,
          brokerOrgId,
        );

        if (!submission) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const parts = req.parts();
        const { requirement, autoPublish, message } =
          await uploadBrokerSignDocument(fastify.prisma, {
            submission,
            brokerOrgId,
            userId,
            parts,
            logger: fastify.log,
          });

        return reply.send({
          success: true,
          message,
          data: formatSignDocumentRequirement(requirement, { viewer: "broker" }),
          autoPublish: {
            published: autoPublish.published,
            signMode: autoPublish.signMode,
            fieldCount: autoPublish.fieldCount,
            reason: autoPublish.reason,
          },
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
        const { requirementIds = [] } = req.body || {};

        const submission = await loadBrokerSubmission(
          fastify.prisma,
          submissionId,
          brokerOrgId,
        );

        if (!submission) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const results = await bulkSendSignDocumentsToClient(fastify.prisma, {
          submission,
          requirementIds,
          brokerFirstName: req.user.firstName,
          io: fastify.io,
          logger: fastify.log,
        });

        return reply.send({
          success: true,
          message: `${results.length} document${results.length === 1 ? "" : "s"} sent to client`,
          data: results.map((item) =>
            formatSignDocumentRequirement(item, { viewer: "broker" }),
          ),
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
        const { requirementIds = [], applicationLenderIds = [] } =
          req.body || {};

        const submission = await loadBrokerSubmission(
          fastify.prisma,
          submissionId,
          brokerOrgId,
        );

        if (!submission) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const result = await bulkForwardSignDocumentsToLenders(fastify.prisma, {
          submission,
          requirementIds,
          applicationLenderIds,
          io: fastify.io,
          logger: fastify.log,
        });

        const lenderLabel =
          result.lenderNames.length === 1
            ? result.lenderNames[0]
            : `${result.lenderNames.length} lenders`;

        return reply.send({
          success: true,
          message: `${result.forwardedCount} document${result.forwardedCount === 1 ? "" : "s"} forwarded to ${lenderLabel}`,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to forward documents to lenders",
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

        const submission = await loadBrokerSubmission(
          fastify.prisma,
          submissionId,
          brokerOrgId,
        );

        if (!submission) {
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

        const submission = await loadBrokerSubmission(
          fastify.prisma,
          submissionId,
          brokerOrgId,
        );

        if (!submission) {
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
