const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { parsePagination } = require("../../../utils/pagination");
const {
  buildApplicationSearchWhere,
} = require("../../../services/applications/loanApplicationSearch");

const PLACEHOLDER_CLIENT_NAMES = new Set([
  "Applicant",
  "Individual Applicant",
  "Unknown",
  "Client",
  "Customer",
  "N/A",
]);

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

function resolveLatestAppClientName(app) {
  const contact =
    app.client?.contacts?.find((row) => row.isPrimary) ||
    app.client?.contacts?.[0];

  const fields = app.submissions?.[0]?.fields || [];

  const fromContact = [contact?.firstName, contact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fromFields = [
    submissionFieldValue(fields, "borrowerFirstName", "firstName", "first_name"),
    submissionFieldValue(fields, "borrowerLastName", "lastName", "last_name"),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const singleName = submissionFieldValue(
    fields,
    "borrowerName",
    "applicantName",
    "fullName",
    "name",
  );

  const legalName = app.client?.legalName?.trim();

  if (fromContact && !PLACEHOLDER_CLIENT_NAMES.has(fromContact)) return fromContact;
  if (fromFields && !PLACEHOLDER_CLIENT_NAMES.has(fromFields)) return fromFields;
  if (singleName && !PLACEHOLDER_CLIENT_NAMES.has(singleName)) return singleName;
  if (legalName && !PLACEHOLDER_CLIENT_NAMES.has(legalName)) return legalName;

  return fromContact || fromFields || singleName || legalName || null;
}

function resolveLatestAppAmount(app) {
  const fields = app.submissions?.[0]?.fields || [];

  const fromSubmission = submissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (fromSubmission) {
    const parsed = Number(String(fromSubmission).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  if (app.amountRequested != null) {
    const direct = Number(app.amountRequested);
    if (!Number.isNaN(direct) && direct > 0) return direct;
  }

  return null;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function latestApplicationsRoutes(fastify) {
  fastify.get(
    "/latest-applications",
    {
      schema: {
        tags: ["Admin -> Dashboard Stats"],
        summary: "Paginated latest loan applications for dashboard",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 5 },
            search: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { skip, take, page, limit } = parsePagination(request.query, 5, 50);
        const search = String(request.query.search || "").trim();

        const where = search
          ? {
              OR: [
                ...buildApplicationSearchWhere(search, { includeBorrower: true }),
                {
                  brokerOrg: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {};

        const [total, applications] = await Promise.all([
          prisma.loanApplication.count({ where }),
          prisma.loanApplication.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              applicationNumber: true,
              status: true,
              loanProductCode: true,
              amountRequested: true,
              createdAt: true,
              brokerOrg: { select: { name: true } },
              client: {
                select: {
                  legalName: true,
                  contacts: {
                    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                    select: {
                      firstName: true,
                      lastName: true,
                      isPrimary: true,
                    },
                  },
                },
              },
              submissions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  fields: {
                    include: {
                      builderField: { select: { fieldKey: true } },
                    },
                  },
                },
              },
              applicationLenders: {
                select: {
                  id: true,
                  lender: { select: { name: true } },
                },
              },
            },
          }),
        ]);

        const data = applications.map((app) => ({
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          product: app.loanProductCode,
          amount: resolveLatestAppAmount(app),
          brokerName: app.brokerOrg?.name || null,
          clientName: resolveLatestAppClientName(app),
          lenderCount: app.applicationLenders.length,
          lenderNames: app.applicationLenders
            .map((row) => row.lender?.name)
            .filter(Boolean),
          createdAt: app.createdAt,
        }));

        return reply.send({
          success: true,
          data,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit) || 1),
          },
        });
      } catch (error) {
        adminLogs.error("Fetching latest applications failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while retrieving latest applications",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    },
  );
}

module.exports = latestApplicationsRoutes;
