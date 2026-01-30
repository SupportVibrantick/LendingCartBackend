module.exports = async function viewSubmission(fastify) {
  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    /* ===============================
       FETCH SUBMISSION
    =============================== */
    const submission =
      await fastify.prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          fields: true,
        },
      });

    if (!submission) {
      return reply.code(404).send({
        success: false,
        message: "Submission not found",
      });
    }

    /* ===============================
       FORMAT RESPONSE
    =============================== */
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        applicationId: submission.applicationId,
        applicationProductId: submission.applicationProductId,
        status: submission.status,
        submittedAt: submission.createdAt,
        fields: submission.fields.map(f => ({
          fieldId: f.fieldId,
          fieldKey: f.fieldKey,
          value: f.value,
          source: f.source,
        })),
      },
    });
  });
};
