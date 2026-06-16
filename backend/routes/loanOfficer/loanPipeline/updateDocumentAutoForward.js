/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { assertOwnsSubmission } = require("../../../services/loanOfficerAccess");
const {
  setAutoForwardDocumentsToLender,
} = require("../../../services/documentAutoForwardSetting");

module.exports = async function updateDocumentAutoForward(fastify) {
  fastify.patch(
    "/submissions/:submissionId/documents/auto-forward",
    {
      schema: {
        tags: ["Loan Officer -> Loan Pipeline"],
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
        const { submissionId } = req.params;
        const { autoForwardDocumentsToLender } = req.body;

        const submission = await assertOwnsSubmission(
          fastify.prisma,
          req,
          reply,
          submissionId,
        );

        if (!submission) return;

        const updated = await setAutoForwardDocumentsToLender(
          fastify.prisma,
          submission.application.id,
          autoForwardDocumentsToLender,
        );

        return reply.send({
          success: true,
          message: autoForwardDocumentsToLender
            ? "Documents will auto-forward to lenders after upload"
            : "Manual review enabled before sending documents to lenders",
          data: updated,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "loan-officer-update-document-auto-forward",
        });

        return reply.code(500).send({
          success: false,
          message:
            error.message || "Failed to update document forwarding setting",
        });
      }
    },
  );
};
