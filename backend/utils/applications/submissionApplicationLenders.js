/**
 * Prisma include for application lenders on submission detail views.
 * Product name/code live on LoanProduct — not on LenderProduct scalars.
 */
const APPLICATION_LENDER_SUBMISSION_INCLUDE = {
  lender: {
    include: {
      users: {
        select: { profileImage: true },
        take: 1,
      },
    },
  },
  lenderProduct: {
    select: {
      id: true,
      loanProductCode: true,
      loanProduct: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  lenderReviews: {
    orderBy: { createdAt: "desc" },
    include: {
      reviewedByUser: true,
      conditions: true,
    },
  },
};

function formatReviewedBy(user) {
  if (!user) return null;

  return {
    userId: user.id,
    name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    email: user.email,
  };
}

function formatLenderReview(review) {
  return {
    reviewId: review.id,
    reviewStatus: review.reviewStatus,
    approvedAmount: review.approvedAmount,
    interestRate: review.interestRate,
    notes: review.notes,
    reviewedAt: review.createdAt,
    updatedAt: review.updatedAt,
    reviewedBy: formatReviewedBy(review.reviewedByUser),
    conditions: (review.conditions || []).map((c) => ({
      conditionId: c.id,
      description: c.description,
      status: c.status,
      satisfiedAt: c.satisfiedAt,
    })),
  };
}

function formatSubmissionApplicationLenders(
  applicationLenders,
  { fundedApplicationLenderId } = {},
) {
  return (applicationLenders || [])
    .filter((l) => l.sentAt)
    .map((l) => {
      const latestReview = l.lenderReviews?.[0] || null;

      return {
        applicationLenderId: l.id,
        lenderOrgId: l.lenderOrgId,
        lenderName: l.lender?.name ?? null,
        profileImage: l.lender?.users?.[0]?.profileImage || null,
        lenderStatus: l.status,
        lenderProductId: l.lenderProductId ?? l.lenderProduct?.id ?? null,
        loanProductCode: l.lenderProduct?.loanProductCode ?? null,
        loanProductName: l.lenderProduct?.loanProduct?.name ?? null,
        ...(fundedApplicationLenderId !== undefined
          ? {
              isFundedLender: fundedApplicationLenderId === l.id,
            }
          : {}),
        sentAt: l.sentAt,
        lastUpdatedAt: l.lastUpdatedAt,
        reviews: (l.lenderReviews || []).map(formatLenderReview),
        latestReview: latestReview ? formatLenderReview(latestReview) : null,
      };
    });
}

module.exports = {
  APPLICATION_LENDER_SUBMISSION_INCLUDE,
  formatSubmissionApplicationLenders,
};
