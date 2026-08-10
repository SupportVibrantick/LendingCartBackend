module.exports = async function viewSubmission(fastify) {
  const { mapSubmissionFieldResponse } = require("../../../../services/applications/staticSubmissionFields");
  const {
    resolveClientDisplayNameFromData,
  } = require("../../../../services/messaging/resolveClientDisplayName");
  const {
    resolveBrokerPipelineDisplayStatus,
    canBrokerEditSubmittedApplication,
    canBrokerRequestDocuments,
  } = require("../../../../utils/applications/resolveApplicationStatus");
  const { getMarkFundedEligibility } = require("../../../../utils/commission/markFundedHelpers");

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
              builderField: {
                include: {
                  section: true,
                },
              },
            },
          },
          application: {
            select: {
              applicationNumber: true,
              loanProductCode: true,
              status: true,
              fundedApplicationLenderId: true,
              fundedAt: true,

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
                    orderBy: { createdAt: "desc" },
                    include: {
                      reviewedByUser: true,
                      conditions: true,
                    },
                  },
                },
              },
              feeAgreement: {
                select: {
                  id: true,
                  brokerPoints: true,
                  upfrontFee: true,
                  status: true,
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
        code: true,
      },
    });

    /* ===============================
       BORROWER NAME
    =============================== */
    const mappedFields = submission.fields.map((f) => mapSubmissionFieldResponse(f));
    const borrowerName = resolveClientDisplayNameFromData(
      submission.application.client,
      [
        {
          fields: submission.fields.map((f) => ({
            fieldKey: f.builderField?.fieldKey || f.fieldKey,
            value: f.value,
            builderField: f.builderField,
          })),
        },
      ],
    );

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
    const documentRequestCheck = canBrokerRequestDocuments(application);
    const fundingEligibility = getMarkFundedEligibility({
      ...application,
      submissions: [
        {
          status: submission.status,
          createdAt: submission.createdAt,
          fields: submission.fields,
        },
      ],
    });
    const canMarkFunded =
      application.status !== "FUNDED" && fundingEligibility.canMarkFunded;

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
              code: loanProduct.code,
            }
          : null,

        // ✅ FIXED VALUES
        amountRequested,
        creditScore,

        applicationProductId: submission.applicationProductId,
        status: displayStatus,
        submissionStatus: submission.status,
        pipelineStatus: displayStatus,
        applicationStatus,
        fundedApplicationLenderId: application.fundedApplicationLenderId,
        fundedAt: application.fundedAt,
        submissionStatus: submission.status,
        canEdit: editCheck.allowed,
        editBlockedReason: editCheck.allowed ? null : editCheck.reason,
        canRequestDocuments: documentRequestCheck.allowed,
        documentRequestBlockedReason: documentRequestCheck.allowed
          ? null
          : documentRequestCheck.reason,
        canMarkFunded,
        markFundedBlockedReason:
          application.status === "FUNDED" || canMarkFunded
            ? null
            : fundingEligibility.markFundedBlockedReason,
        feeAgreement: application.feeAgreement
          ? {
              id: application.feeAgreement.id,
              brokerPoints: application.feeAgreement.brokerPoints,
              upfrontFee: application.feeAgreement.upfrontFee,
              status: application.feeAgreement.status,
            }
          : null,
        submittedAt: submission.createdAt,

        /* ================= FIELDS ================= */
        fields: mappedFields,

        /* ================= LENDER REVIEWS ================= */
        lenders: submission.application.applicationLenders
          .filter((l) => l.sentAt)
          .map((l) => ({
            applicationLenderId: l.id,
            lenderOrgId: l.lenderOrgId,
            lenderName: l.lender?.name ?? null,
            profileImage: l.lender?.users?.[0]?.profileImage || null,
            lenderStatus: l.status,
            isFundedLender:
              application.fundedApplicationLenderId === l.id,
            sentAt: l.sentAt,
            lastUpdatedAt: l.lastUpdatedAt,

            reviews: l.lenderReviews.map((r) => ({
              reviewId: r.id,
              reviewStatus: r.reviewStatus,
              approvedAmount: r.approvedAmount,
              interestRate: r.interestRate,
              notes: r.notes,
              reviewedAt: r.createdAt,
              updatedAt: r.updatedAt,

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
            latestReview: l.lenderReviews[0]
              ? {
                  reviewId: l.lenderReviews[0].id,
                  reviewStatus: l.lenderReviews[0].reviewStatus,
                  approvedAmount: l.lenderReviews[0].approvedAmount,
                  interestRate: l.lenderReviews[0].interestRate,
                  notes: l.lenderReviews[0].notes,
                  reviewedAt: l.lenderReviews[0].createdAt,
                  updatedAt: l.lenderReviews[0].updatedAt,
                  reviewedBy: l.lenderReviews[0].reviewedByUser
                    ? {
                        userId: l.lenderReviews[0].reviewedByUser.id,
                        name: `${l.lenderReviews[0].reviewedByUser.firstName ?? ""} ${
                          l.lenderReviews[0].reviewedByUser.lastName ?? ""
                        }`.trim(),
                        email: l.lenderReviews[0].reviewedByUser.email,
                      }
                    : null,
                  conditions: l.lenderReviews[0].conditions.map((c) => ({
                    conditionId: c.id,
                    description: c.description,
                    status: c.status,
                    satisfiedAt: c.satisfiedAt,
                  })),
                }
              : null,
          })),
      },
    });
  });
};