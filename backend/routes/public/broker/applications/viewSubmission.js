module.exports = async function viewSubmission(fastify) {
  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    /* ===============================
       FETCH SUBMISSION + MAP BUILDER
    =============================== */
    const submission =
      await fastify.prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          fields: {
            include: {
              builderField: true, //  works once relation exists
            },
          },
        },
      });

    if (!submission) {
      return reply.code(404).send({
        success: false,
        message: "Submission not found",
      });
    }

    /* ===============================
       FORMAT RESPONSE (CORRECT)
    =============================== */
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        applicationId: submission.applicationId,
        applicationProductId: submission.applicationProductId,
        status: submission.status,
        submittedAt: submission.createdAt,
        fields: submission.fields.map((f) => ({
          fieldId: f.fieldId,

          // always prefer builder (latest)
          fieldKey: f.builderField?.fieldKey ?? f.fieldKey,
          label: f.builderField?.label ?? "Deleted Field",
          type: f.builderField?.fieldType ?? null,
          options: f.builderField?.options ?? null,

          //  already parsed by Prisma
          value: f.value,

          source: f.source,
        })),
      },
    });
  });
};
