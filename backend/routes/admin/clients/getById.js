const { resolveClientDisplayNameFromData } = require("../../../services/resolveClientDisplayName");
const {
  buildApplicationSearchWhere,
  loanApplicationListInclude,
} = require("../../../services/loanApplicationSearch");
const { formatAdminClientRow } = require("../../../services/formatAdminClientRow");

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

function formatClientApplication(app) {
  const fields = app.submissions?.[0]?.fields || [];
  const amountRequested = app.amountRequested ?? resolveAmountFromFields(fields);

  return {
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    loanProductCode: app.loanProductCode,
    amountRequested: amountRequested != null ? Number(amountRequested) : null,
    status: app.status,
    createdAt: app.createdAt,
    borrowerName: resolveClientDisplayNameFromData(app.client, app.submissions),
    purpose:
      submissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds") ||
      app.purpose ||
      null,
  };
}

const clientInclude = {
  primaryBroker: { select: { id: true, name: true, status: true } },
  contacts: {
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    select: {
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      isPrimary: true,
    },
  },
  loanApplications: {
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      submissions: {
        orderBy: { createdAt: "desc" },
        include: {
          fields: {
            include: {
              builderField: { select: { fieldKey: true } },
            },
          },
        },
      },
    },
  },
  _count: { select: { loanApplications: true, portalUsers: true } },
};

async function getClientById(fastify) {
  fastify.get(
    "/:id/applications",
    {
      schema: {
        tags: ["Admin -> Clients"],
        summary: "List applications for a client",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      const brokerOrgId = req.query?.brokerOrgId?.trim();
      const page = Math.max(parseInt(req.query?.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query?.limit || "10", 10), 1), 50);
      const skip = (page - 1) * limit;
      const search = req.query?.search?.trim();

      const client = await prisma.client.findFirst({
        where: {
          id,
          isDeleted: { not: true },
          ...(brokerOrgId ? { primaryBrokerOrgId: brokerOrgId } : {}),
        },
        select: { id: true },
      });

      if (!client) {
        return reply.code(404).send({ success: false, message: "Client not found" });
      }

      const where = {
        clientId: id,
        ...(brokerOrgId ? { brokerOrgId } : {}),
      };

      if (search) {
        where.OR = buildApplicationSearchWhere(search, { includeBorrower: true });
      }

      const [applications, total, amountAgg] = await prisma.$transaction([
        prisma.loanApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: loanApplicationListInclude,
        }),
        prisma.loanApplication.count({ where }),
        prisma.loanApplication.aggregate({
          where,
          _sum: { amountRequested: true },
        }),
      ]);

      return reply.send({
        success: true,
        data: applications.map(formatClientApplication),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        summary: {
          totalAmount:
            amountAgg._sum.amountRequested != null
              ? Number(amountAgg._sum.amountRequested)
              : 0,
        },
      });
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Clients"],
        summary: "Get client details",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      const brokerOrgId = req.query?.brokerOrgId?.trim();

      const row = await prisma.client.findFirst({
        where: {
          id,
          isDeleted: { not: true },
          ...(brokerOrgId ? { primaryBrokerOrgId: brokerOrgId } : {}),
        },
        include: clientInclude,
      });

      if (!row) {
        return reply.code(404).send({ success: false, message: "Client not found" });
      }

      return reply.send({
        success: true,
        data: formatAdminClientRow(row),
      });
    },
  );
}

module.exports = getClientById;
