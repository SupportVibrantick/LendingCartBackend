module.exports = async function viewSubmission(fastify) {
  const { mapSubmissionFieldResponse } = require("../../../../services/staticSubmissionFields");
  const {
    resolveBrokerPipelineDisplayStatus,
    canBrokerEditSubmittedApplication,
  } = require("../../../../utils/resolveApplicationStatus");

  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    /* ===============================
       FETCH SUBMISSION + EXTRA DATA
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
            select: {
              applicationNumber: true,
              loanProductCode: true,
              status: true,

              // ❌ DO NOT TRUST THIS (kept only if needed later)
              amountRequested: true,

              client: {
                include: {
                  contacts: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },

              applicationLenders: {
                include: {
                  lender: {
                    include: {
                      users: {
                        select: {
                          profileImage: true,
                        },
                        take: 1,
                      },
                    },
                  },
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
       FETCH LOAN PRODUCT NAME
    =============================== */
    const loanProduct = await fastify.prisma.loanProduct.findFirst({
      where: {
        code: submission.application.loanProductCode,
      },
      select: {
        id: true,
        name: true,
      },
    });

    /* ===============================
       BORROWER NAME
    =============================== */
    const primaryContact =
      submission.application.client?.contacts?.[0] || null;

    const borrowerName = primaryContact
      ? `${primaryContact.firstName ?? ""} ${
          primaryContact.lastName ?? ""
        }`.trim()
      : null;

    /* ===============================
       🔥 EXTRACT IMPORTANT FIELDS
    =============================== */

    // ✅ CREDIT SCORE
    const creditScoreField = submission.fields.find(
      (f) =>
        f.builderField?.fieldKey === "creditScore" ||
        f.builderField?.fieldKey === "credit_score" ||
        f.fieldKey === "creditScore" ||
        f.fieldKey === "credit_score"
    );

    const creditScore = creditScoreField?.value ?? null;

    // ✅ AMOUNT REQUESTED (FIXED)
    const amountField = submission.fields.find(
      (f) =>
        f.builderField?.fieldKey === "amountRequested" ||
        f.builderField?.fieldKey === "loan_amount" ||
        f.fieldKey === "amountRequested" ||
        f.fieldKey === "loan_amount"
    );

    const amountRequested = amountField?.value ?? null;

    const application = submission.application;
    const applicationStatus = application?.status ?? null;
    const displayStatus = resolveBrokerPipelineDisplayStatus(application);
    const editCheck = canBrokerEditSubmittedApplication(application);

    /* ===============================
       RESPONSE
    =============================== */
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        applicationId: submission.applicationId,
        applicationNumber: submission.application.applicationNumber,

        borrowerName,

        loanProduct: loanProduct
          ? {
              id: loanProduct.id,
              name: loanProduct.name,
            }
          : null,

        // ✅ FIXED VALUES
        amountRequested,
        creditScore,

        applicationProductId: submission.applicationProductId,
        status: displayStatus,
        applicationStatus,
        submissionStatus: submission.status,
        canEdit: editCheck.allowed,
        editBlockedReason: editCheck.allowed ? null : editCheck.reason,
        submittedAt: submission.createdAt,

        /* ================= FIELDS ================= */
        fields: submission.fields.map((f) => mapSubmissionFieldResponse(f)),

        /* ================= LENDER REVIEWS ================= */
        lenders: submission.application.applicationLenders
          .filter((l) => l.sentAt)
          .map((l) => ({
            applicationLenderId: l.id,
            lenderOrgId: l.lenderOrgId,
            lenderName: l.lender?.name ?? null,
            profileImage: l.lender?.users?.[0]?.profileImage || null,
            lenderStatus: l.status,
            sentAt: l.sentAt,
            lastUpdatedAt: l.lastUpdatedAt,

            reviews: l.lenderReviews.map((r) => ({
              reviewId: r.id,
              reviewStatus: r.reviewStatus,
              approvedAmount: r.approvedAmount,
              interestRate: r.interestRate,
              notes: r.notes,
              reviewedAt: r.createdAt,

              reviewedBy: r.reviewedByUser
                ? {
                    userId: r.reviewedByUser.id,
                    name: `${r.reviewedByUser.firstName ?? ""} ${
                      r.reviewedByUser.lastName ?? ""
                    }`.trim(),
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