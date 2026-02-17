module.exports = async function viewSubmission(fastify) {
  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    try {
      /* ===============================
         FETCH SUBMISSION + BUILDER + LENDER REVIEW
      =============================== */
      const submission =
        await fastify.prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: {
            fields: {
              include: {
                builderField: true,
              },
            },

            // 🔥 ADD THIS (relation name may vary)
            lenderReviews: {
              include: {
                conditions: true,
                lenderUser: true, // optional (who reviewed)
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

          // -----------------------
          // Fields
          // -----------------------
          fields: submission.fields.map((f) => ({
            fieldId: f.fieldId,
            fieldKey: f.builderField?.fieldKey ?? f.fieldKey,
            label: f.builderField?.label ?? "Deleted Field",
            type: f.builderField?.fieldType ?? null,
            options: f.builderField?.options ?? null,
            value: f.value,
            source: f.source,
          })),

          // -----------------------
          // LENDER REVIEW SECTION
          // -----------------------
          lenderReviews: submission.lenderReviews.map((review) => ({
            reviewId: review.id,
            decision: review.decision, // APPROVED / REJECTED / CONDITIONAL
            remarks: review.remarks,
            reviewedAt: review.createdAt,

            reviewedBy: review.lenderUser
              ? {
                  id: review.lenderUser.id,
                  name: review.lenderUser.name,
                  email: review.lenderUser.email,
                }
              : null,

            conditions: review.conditions.map((c) => ({
              id: c.id,
              description: c.description,
              status: c.status,
            })),
          })),
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Server error",
      });
    }
  });
};