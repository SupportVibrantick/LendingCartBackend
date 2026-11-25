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

const LOI_SORT_OPTIONS = new Set([
  "newest",
  "oldest",
  "amount_desc",
  "amount_asc",
  "rate_asc",
  "rate_desc",
  "lender_az",
]);

function parseLoiListQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(query.limit, 10) || 5));
  const search = String(query.search || "").trim();
  const rawSort = String(query.sort || "newest").trim().toLowerCase();
  const sort = LOI_SORT_OPTIONS.has(rawSort) ? rawSort : "newest";

  return { page, limit, search, sort, skip: (page - 1) * limit };
}

/** Prisma orderBy for sorts that don't need review field values. */
function buildLoiPrismaOrderBy(sort = "newest") {
  switch (sort) {
    case "oldest":
      return [{ sentAt: "asc" }, { lastUpdatedAt: "asc" }];
    case "lender_az":
      return [{ lender: { name: "asc" } }, { sentAt: "desc" }];
    case "newest":
    default:
      return [{ sentAt: "desc" }, { lastUpdatedAt: "desc" }];
  }
}

function needsLoiReviewFieldSort(sort = "newest") {
  return (
    sort === "amount_desc" ||
    sort === "amount_asc" ||
    sort === "rate_asc" ||
    sort === "rate_desc"
  );
}

/**
 * Sort formatted LOI records (parity with broker-dashboard sortBrokerLois).
 * Used when rate/amount require latest LenderReview values.
 */
function sortFormattedLois(lois, sort = "newest") {
  const copy = [...(lois || [])];

  copy.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return (
          new Date(a.generatedAt || a.sentAt || 0).getTime() -
          new Date(b.generatedAt || b.sentAt || 0).getTime()
        );
      case "amount_desc":
        return (b.approvedAmount ?? -1) - (a.approvedAmount ?? -1);
      case "amount_asc":
        return (a.approvedAmount ?? Number.POSITIVE_INFINITY) -
          (b.approvedAmount ?? Number.POSITIVE_INFINITY);
      case "rate_asc":
        return (a.interestRate ?? Number.POSITIVE_INFINITY) -
          (b.interestRate ?? Number.POSITIVE_INFINITY);
      case "rate_desc":
        return (b.interestRate ?? -1) - (a.interestRate ?? -1);
      case "lender_az":
        return String(a.lenderName || "").localeCompare(
          String(b.lenderName || ""),
        );
      case "newest":
      default:
        return (
          new Date(b.generatedAt || b.sentAt || 0).getTime() -
          new Date(a.generatedAt || a.sentAt || 0).getTime()
        );
    }
  });

  return copy;
}

/**
 * List + sort + paginate LOIs for an application.
 * LOI counts per application are typically small, so we sort after formatting
 * to keep rate/amount/date behavior consistent with the dashboard.
 */
async function queryBrokerLois(prisma, { where, sort, skip, limit }) {
  const lenders = await prisma.applicationLender.findMany({
    where,
    include: APPLICATION_LENDER_LOI_INCLUDE,
    orderBy: buildLoiPrismaOrderBy(
      sort === "lender_az" ? "lender_az" : "newest",
    ),
  });
  const sorted = sortFormattedLois(lenders.map(formatBrokerLoiRecord), sort);
  return sorted.slice(skip, skip + limit);
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

  const normalized = String(search).trim();
  if (!normalized) return {};

  return {
    OR: [
      { lender: { name: { contains: normalized, mode: "insensitive" } } },
      { lender: { email: { contains: normalized, mode: "insensitive" } } },
      { lender: { phone: { contains: normalized, mode: "insensitive" } } },
      {
        lenderProduct: {
          loanProduct: {
            name: { contains: normalized, mode: "insensitive" },
          },
        },
      },
      {
        lenderProduct: {
          interestRateRange: { contains: normalized, mode: "insensitive" },
        },
      },
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
  LOI_SORT_OPTIONS,
  parseLoiListQuery,
  buildLoiPrismaOrderBy,
  needsLoiReviewFieldSort,
  sortFormattedLois,
  queryBrokerLois,
  formatBrokerLoiRecord,
  buildLoiSearchFilter,
  buildLoiPagination,
};
