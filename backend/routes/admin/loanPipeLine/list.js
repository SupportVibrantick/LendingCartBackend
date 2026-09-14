const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  buildApplicationSearchWhere,
  loanApplicationListInclude,
} = require("../../../services/applications/loanApplicationSearch");

function submissionFieldValue(fields, ...keys) {
  for (const field of fields || []) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      if (typeof raw.value === "string" || typeof raw.value === "number") {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }

    return String(raw).trim();
  }

  return null;
}

function resolveAmountFromFields(fields) {
  const raw = submissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (!raw) return null;
  const amount = Number(String(raw).replace(/[,$]/g, ""));
  return Number.isNaN(amount) ? null : amount;
}

function resolveEntityType(app, fields) {
  return (
    app.client?.entityType ||
    submissionFieldValue(
      fields,
      "entityType",
      "borrowerEntityType",
      "businessEntityType",
    ) ||
    "-"
  );
}

function formatApplicationRow(app) {
  const fields = app.submissions?.[0]?.fields || [];
  const amountRequested =
    app.amountRequested != null
      ? Number(app.amountRequested)
      : resolveAmountFromFields(fields);

  return {
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    loanProductCode: app.loanProductCode,
    amountRequested,
    status: app.status,
    createdAt: app.createdAt,
    borrowerName: resolveClientDisplayNameFromData(app.client, app.submissions),
    entityType: resolveEntityType(app, fields),
    purpose:
      submissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds") ||
      app.purpose ||
      null,
    client: app.client,
    broker: app.brokerOrg,
    lenders: (app.applicationLenders || []).map((al) => ({
      lenderOrgId: al.lenderOrgId,
      lenderName: al.lender?.name,
      lenderProduct: al.lenderProduct?.loanProductCode,
      lenderStatus: al.status,
      sentAt: al.sentAt,
    })),
  };
}

const applicationListInclude = {
  ...loanApplicationListInclude,
  brokerOrg: {
    select: {
      id: true,
      name: true,
    },
  },
  applicationLenders: {
    include: {
      lender: {
        select: {
          id: true,
          name: true,
        },
      },
      lenderProduct: {
        select: {
          loanProductCode: true,
        },
      },
    },
  },
};

const VALID_APPLICATION_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "AUTO_APPROVED",
  "AUTO_DECLINED",
  "LENDER_SELECTED",
  "LENDER_APPROVED",
  "LENDER_DECLINED",
  "FUNDED",
  "WITHDRAWN",
  "CLIENT_PENDING",
  "SUSPENDED",
]);

/** Map UI filter aliases to Prisma LoanApplicationStatus values. */
function resolveStatusFilter(rawStatus) {
  const status = String(rawStatus || "").trim().toUpperCase();
  if (!status) return null;

  if (status === "APPROVED") {
    return { in: ["LENDER_APPROVED", "AUTO_APPROVED", "FUNDED"] };
  }
  if (status === "DECLINED" || status === "REJECTED") {
    return { in: ["LENDER_DECLINED", "AUTO_DECLINED"] };
  }
  if (VALID_APPLICATION_STATUSES.has(status)) {
    return status;
  }
  return null;
}

function bucketStatusCounts(statusGroups = []) {
  const statusCounts = {};
  let countsTotal = 0;

  for (const group of statusGroups) {
    const key = group.status;
    const count = group._count._all;
    statusCounts[key] = (statusCounts[key] || 0) + count;
    countsTotal += count;
  }

  // UI chips use simplified Approved / Rejected labels.
  statusCounts.APPROVED =
    (statusCounts.LENDER_APPROVED || 0) +
    (statusCounts.AUTO_APPROVED || 0) +
    (statusCounts.FUNDED || 0);
  statusCounts.DECLINED =
    (statusCounts.LENDER_DECLINED || 0) + (statusCounts.AUTO_DECLINED || 0);

  return {
    statusCounts,
    countsTotal,
    inReviewCount:
      (statusCounts.IN_REVIEW || 0) + (statusCounts.SUBMITTED || 0),
    approvedCount: statusCounts.APPROVED,
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listAllApplications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Pipeline"], 
        summary: "View all submitted applications",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { skip, take, page, limit } = require("../../../utils/pagination").parsePagination(req.query);
        const brokerOrgId = req.query?.brokerOrgId?.trim();
        const search = req.query?.search?.trim();
        const statusFilter = resolveStatusFilter(req.query?.status);

        if (req.query?.status?.trim() && !statusFilter) {
          return reply.code(400).send({
            success: false,
            message: "Invalid status filter",
          });
        }

        const baseWhere = {
          ...(brokerOrgId ? { brokerOrgId } : {}),
        };

        if (search) {
          baseWhere.OR = buildApplicationSearchWhere(search, {
            includeBorrower: true,
          });
        }

        // Status chip counts share search/broker scope but ignore the active status filter.
        const countsWhere = {
          ...baseWhere,
          ...(brokerOrgId ? {} : { status: { not: "DRAFT" } }),
        };

        const where = {
          ...baseWhere,
          ...(statusFilter
            ? { status: statusFilter }
            : brokerOrgId
              ? {}
              : { status: { not: "DRAFT" } }),
        };

        const findArgs = {
          where,
          orderBy: { createdAt: "desc" },
          include: applicationListInclude,
          skip,
          take,
        };

        const [applications, total, amountAgg, statusGroups] =
          await prisma.$transaction([
            prisma.loanApplication.findMany(findArgs),
            prisma.loanApplication.count({ where }),
            prisma.loanApplication.aggregate({
              where,
              _sum: { amountRequested: true },
            }),
            prisma.loanApplication.groupBy({
              by: ["status"],
              where: countsWhere,
              _count: { _all: true },
            }),
          ]);

        const formatted = applications.map(formatApplicationRow);
        const buckets = bucketStatusCounts(statusGroups);

        return reply.send({
          success: true,
          total,
          data: formatted,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
            hasMore: page * limit < total,
            hasPreviousPage: page > 1,
            hasNextPage: page * limit < total,
          },
          summary: {
            totalAmount:
              amountAgg._sum.amountRequested != null
                ? Number(amountAgg._sum.amountRequested)
                : 0,
            statusCounts: buckets.statusCounts,
            countsTotal: buckets.countsTotal,
            inReviewCount: buckets.inReviewCount,
            approvedCount: buckets.approvedCount,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Server error",
        });

      }
    },
  );
}

module.exports = listAllApplications;
