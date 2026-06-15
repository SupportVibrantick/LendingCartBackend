/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  setAutoForwardDocumentsToLender,
} = require("../../../services/documentAutoForwardSetting");

module.exports = async function updateDocumentAutoForward(fastify) {
  fastify.patch(
    "/submissions/:submissionId/documents/auto-forward",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Toggle auto-forward of uploaded documents to lenders",
        body: {
          type: "object",
          required: ["autoForwardDocumentsToLender"],
          properties: {
            autoForwardDocumentsToLender: { type: "boolean" },
          },
        },
      },
    },
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
        const { autoForwardDocumentsToLender } = req.body;

        const submission = await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        if (submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied for this loan",
          });
        }

        const updated = await setAutoForwardDocumentsToLender(
          fastify.prisma,
          submission.application.id,
          autoForwardDocumentsToLender,
        );

        return reply.send({
          success: true,
          message: autoForwardDocumentsToLender
            ? "Documents will auto-forward to lenders after upload"
            : "Broker review enabled before sending documents to lenders",
          data: updated,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "update-document-auto-forward",
        });

        return reply.code(500).send({
          success: false,
          message: error.message ||"Failed to update document forwarding setting",
        });
      }
    },
  );
};
