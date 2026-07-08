const APPLICATION_LENDER_LOI_INCLUDE = {
  lender: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  lenderProduct: {
    select: {
      id: true,
      loanProductCode: true,
      minLoanAmount: true,
      maxLoanAmount: true,
      minTermMonths: true,
      maxTermMonths: true,
      interestRateRange: true,
      maxLtvPercent: true,
      maxArvPercent: true,
      maxLtcPercent: true,
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
    take: 1,
    include: {
      reviewedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      conditions: {
        select: {
          id: true,
          description: true,
          status: true,
          satisfiedAt: true,
        },
      },
    },
  },
};

function parseLoiListQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(query.limit, 10) || 5));
  const search = String(query.search || "").trim();

  return { page, limit, search, skip: (page - 1) * limit };
}

function formatReviewerName(user) {
  if (!user) return null;

  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || null;
}

function formatBrokerLoiRecord(record) {
  const review = record.lenderReviews?.[0] || null;
  const product = record.lenderProduct || null;

  return {
    applicationLenderId: record.id,
    loanApplicationId: record.loanApplicationId,
    lenderOrgId: record.lender?.id ?? null,
    lenderName: record.lender?.name ?? "N/A",
    lenderEmail: record.lender?.email ?? null,
    lenderPhone: record.lender?.phone ?? null,
    status: record.status,
    reviewStatus: review?.reviewStatus ?? null,
    loiUrl: record.loiUrl,
    sentAt: record.sentAt,
    lastUpdatedAt: record.lastUpdatedAt,
    approvedAmount:
      review?.approvedAmount != null ? Number(review.approvedAmount) : null,
    interestRate:
      review?.interestRate != null ? Number(review.interestRate) : null,
    notes: review?.notes ?? null,
    generatedAt: review?.createdAt ?? null,
    reviewedAt: review?.updatedAt ?? review?.createdAt ?? null,
    reviewedBy: review?.reviewedByUser
      ? {
          userId: review.reviewedByUser.id,
          name: formatReviewerName(review.reviewedByUser),
          email: review.reviewedByUser.email ?? null,
        }
      : null,
    conditions: (review?.conditions || []).map((condition) => ({
      conditionId: condition.id,
      description: condition.description,
      status: condition.status,
      satisfiedAt: condition.satisfiedAt,
    })),
    lenderProduct: product
      ? {
          id: product.id,
          loanProductCode: product.loanProductCode,
          productName: product.loanProduct?.name ?? null,
          minLoanAmount:
            product.minLoanAmount != null
              ? Number(product.minLoanAmount)
              : null,
          maxLoanAmount:
            product.maxLoanAmount != null
              ? Number(product.maxLoanAmount)
              : null,
          minTermMonths: product.minTermMonths ?? null,
          maxTermMonths: product.maxTermMonths ?? null,
          interestRateRange: product.interestRateRange ?? null,
          maxLtvPercent:
            product.maxLtvPercent != null
              ? Number(product.maxLtvPercent)
              : null,
          maxArvPercent:
            product.maxArvPercent != null
              ? Number(product.maxArvPercent)
              : null,
          maxLtcPercent:
            product.maxLtcPercent != null
              ? Number(product.maxLtcPercent)
              : null,
        }
      : null,
  };
}

function buildLoiSearchFilter(search) {
  if (!search) return {};

  return {
    OR: [
      { lender: { name: { contains: search, mode: "insensitive" } } },
      { lender: { email: { contains: search, mode: "insensitive" } } },
      { status: { equals: search.toUpperCase() } },
    ],
  };
}

function buildLoiPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

module.exports = {
  APPLICATION_LENDER_LOI_INCLUDE,
  parseLoiListQuery,
  formatBrokerLoiRecord,
  buildLoiSearchFilter,
  buildLoiPagination,
};
