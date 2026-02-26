module.exports = async function viewSubmission(fastify) {
  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    /* ===============================
       FETCH SUBMISSION + MAP BUILDER
       + LENDER REVIEWS
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
          application: {
            include: {
              applicationLenders: {
                include: {
                  lender: true,
                  lenderProduct: true,
                  lenderReviews: {
                    include: {
                      reviewedByUser: true,
                      conditions: true,
                    },
                  },
                },
              },
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
       FORMAT RESPONSE (NO BREAKING)
    =============================== */
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        applicationId: submission.applicationId,
        applicationProductId: submission.applicationProductId,
        status: submission.status,
        submittedAt: submission.createdAt,

        /* ================= FIELDS ================= */
        fields: submission.fields.map((f) => ({
          fieldId: f.fieldId,
          fieldKey: f.builderField?.fieldKey ?? f.fieldKey,
          label: f.builderField?.label ?? "Deleted Field",
          type: f.builderField?.fieldType ?? null,
          options: f.builderField?.options ?? null,
          value: f.value,
          source: f.source,
        })),

        /* ================= LENDER REVIEWS ================= */
        lenders: submission.application.applicationLenders.map((l) => ({
          applicationLenderId: l.id,
          lenderOrgId: l.lenderOrgId,
          lenderName: l.lender?.name ?? null,
          lenderStatus: l.status,
          sentAt: l.sentAt,
          lastUpdatedAt: l.lastUpdatedAt,

          reviews: l.lenderReviews.map((r) => ({
            reviewId: r.id,
            reviewStatus: r.reviewStatus, // APPROVED / DECLINED / CONDITIONAL
            approvedAmount: r.approvedAmount,
            interestRate: r.interestRate,
            notes: r.notes, // reason for rejection/approval
            reviewedAt: r.createdAt,

            reviewedBy: r.reviewedByUser
              ? {
                  userId: r.reviewedByUser.id,
                  name: `${r.reviewedByUser.firstName ?? ""} ${r.reviewedByUser.lastName ?? ""}`.trim(),
                  email: r.reviewedByUser.email,
                }
              : null,

            conditions: r.conditions.map((c) => ({
              conditionId: c.id,
              description: c.description,
              status: c.status,
              satisfiedAt: c.satisfiedAt,
            })),
          })),
        })),
      },
    });
  });
};