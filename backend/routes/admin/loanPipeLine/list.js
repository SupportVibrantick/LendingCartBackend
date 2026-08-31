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
        const { skip, take, page, limit } = require("../../utils/pagination").parsePagination(req.query);
        const brokerOrgId = req.query?.brokerOrgId?.trim();
        const search = req.query?.search?.trim();

        const where = {
          ...(brokerOrgId ? { brokerOrgId } : { status: { not: "DRAFT" } }),
        };

        if (search) {
          where.OR = buildApplicationSearchWhere(search, { includeBorrower: true });
        }

        const findArgs = {
          where,
          orderBy: { createdAt: "desc" },
          include: applicationListInclude,
          skip,
          take,
        };

        const [applications, total, amountAgg] = await prisma.$transaction([
          prisma.loanApplication.findMany(findArgs),
          prisma.loanApplication.count({ where }),
          prisma.loanApplication.aggregate({
            where,
            _sum: { amountRequested: true },
          }),
        ]);

        const formatted = applications.map(formatApplicationRow);

        return reply.send({
          success: true,
          total,
          data: formatted,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
            hasMore: applications.length === limit,
          },
          summary: {
            totalAmount:
              amountAgg._sum.amountRequested != null
                ? Number(amountAgg._sum.amountRequested)
                : 0,
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
