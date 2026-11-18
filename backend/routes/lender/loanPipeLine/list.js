/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const LIST_FIELD_KEYS = [
  "borrowerFirstName",
  "firstName",
  "first_name",
  "borrowerLastName",
  "lastName",
  "last_name",
  "borrowerName",
  "applicantName",
  "fullName",
  "name",
  "entityType",
  "borrowerEntityType",
  "businessType",
  "amountRequested",
  "loan_amount",
];

function getFieldValue(fields = [], ...keys) {
  return fields.find((field) =>
    keys.includes(field.builderField?.fieldKey || field.fieldKey),
  )?.value;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveBorrowerName(app) {
  const contact = app?.client?.contacts?.[0] || null;
  const fields = app?.submissions?.[0]?.fields || [];
  const borrowerFirstName = normalizeText(
    getFieldValue(fields, "borrowerFirstName", "firstName", "first_name"),
  );
  const borrowerLastName = normalizeText(
    getFieldValue(fields, "borrowerLastName", "lastName", "last_name"),
  );
  const fullNameFromFields = [borrowerFirstName, borrowerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const clientLegalName = normalizeText(app?.client?.legalName);

  return (
    [contact?.firstName, contact?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fullNameFromFields ||
    getFieldValue(
      fields,
      "borrowerName",
      "applicantName",
      "fullName",
      "name",
    ) ||
    (clientLegalName &&
    !["Applicant", "Individual Applicant"].includes(clientLegalName)
      ? clientLegalName
      : null) ||
    "N/A"
  );
}

function resolveBorrowerEntityType(app) {
  const fields = app?.submissions?.[0]?.fields || [];

  return (
    app?.client?.entityType ||
    getFieldValue(
      fields,
      "entityType",
      "borrowerEntityType",
      "businessType",
    ) ||
    "-"
  );
}

function buildSearchWhere(search) {
  if (!search) return {};

  return {
    loanApplication: {
      OR: [
        {
          applicationNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          client: {
            is: {
              OR: [
                {
                  legalName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  contacts: {
                    some: {
                      OR: [
                        {
                          firstName: {
                            contains: search,
                            mode: "insensitive",
                          },
                        },
                        {
                          lastName: {
                            contains: search,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          brokerOrg: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
  };
}

function matchesDecisionFilter(latestDecision, decisionFilter) {
  if (!decisionFilter) return true;

  if (decisionFilter === "PENDING") {
    return !latestDecision || latestDecision === "IN_REVIEW";
  }

  return latestDecision === decisionFilter;
}

const PAGE_LIST_SELECT = {
  id: true,
  status: true,
  sentAt: true,
  loiUrl: true,
  loiSentToBrokerAt: true,
  lenderReviews: {
    take: 1,
    orderBy: { createdAt: "desc" },
    select: {
      reviewStatus: true,
      approvedAmount: true,
      interestRate: true,
      createdAt: true,
    },
  },
  loanApplication: {
    select: {
      id: true,
      applicationNumber: true,
      loanProductCode: true,
      amountRequested: true,
      status: true,
      createdAt: true,
      client: {
        select: {
          id: true,
          legalName: true,
          entityType: true,
          contacts: {
            select: {
              firstName: true,
              lastName: true,
            },
            take: 1,
          },
        },
      },
      brokerOrg: {
        select: {
          id: true,
          name: true,
        },
      },
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          fields: {
            where: {
              OR: [
                { fieldKey: { in: LIST_FIELD_KEYS } },
                { builderField: { fieldKey: { in: LIST_FIELD_KEYS } } },
              ],
            },
            select: {
              value: true,
              fieldKey: true,
              builderField: {
                select: {
                  fieldKey: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          documentRequirements: {
            where: {
              status: { not: "COMPLETE" },
            },
          },
        },
      },
    },
  },
};

function formatPipelineRow(item) {
  const app = item.loanApplication;
  const latestReview = item.lenderReviews?.[0] ?? null;
  const fields = app.submissions?.[0]?.fields || [];
  const borrowerFirstName = normalizeText(
    getFieldValue(fields, "borrowerFirstName", "firstName", "first_name"),
  );
  const borrowerLastName = normalizeText(
    getFieldValue(fields, "borrowerLastName", "lastName", "last_name"),
  );

  let amountRequested = null;

  if (app.submissions?.length) {
    amountRequested =
      Number(getFieldValue(fields, "amountRequested", "loan_amount")) || null;
  }

  if (amountRequested == null && app.amountRequested != null) {
    const fallbackAmount = Number(app.amountRequested);
    amountRequested = Number.isFinite(fallbackAmount) ? fallbackAmount : null;
  }

  return {
    applicationLenderId: item.id,
    loiUrl: item.loiUrl,
    loiGenerated: !!item.loiUrl,
    loiSentToBroker: !!item.loiSentToBrokerAt,
    loiSentToBrokerAt: item.loiSentToBrokerAt,
    lenderPipelineStatus: item.status,
    lenderDecision: latestReview?.reviewStatus ?? null,
    approvedAmount: latestReview?.approvedAmount ?? null,
    interestRate: latestReview?.interestRate ?? null,
    sentAt: item.sentAt,
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    borrowerFirstName,
    borrowerLastName,
    borrowerName: resolveBorrowerName(app),
    borrowerEntityType: resolveBorrowerEntityType(app),
    loanProductCode: app.loanProductCode,
    amountRequested,
    applicationStatus: app.status,
    createdAt: app.createdAt,
    pendingDocumentsCount: app._count?.documentRequirements || 0,
    client: app.client,
    broker: app.brokerOrg,
  };
}

async function listSubmittedApplications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "List applications sent to lender",
        querystring: {
          type: "object",
          properties: {
            search: {
              type: "string",
            },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
            decision: {
              type: "string",
              enum: ["PENDING", "CONDITIONAL", "APPROVED", "DECLINED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(
          Math.max(Number(req.query.limit) || 10, 1),
          100,
        );
        const decisionFilter = req.query.decision || null;
        const search =
          typeof req.query.search === "string" ? req.query.search.trim() : "";

        const baseWhere = {
          lenderOrgId,
          ...buildSearchWhere(search || null),
        };

        let total;
        let totalPages;
        let safePage;
        let pageIds;

        if (decisionFilter) {
          // Latest-review filtering needs a candidate pass; keep it lean (id + status only).
          const candidates = await prisma.applicationLender.findMany({
            where: baseWhere,
            select: {
              id: true,
              lenderReviews: {
                take: 1,
                orderBy: { createdAt: "desc" },
                select: { reviewStatus: true },
              },
            },
            orderBy: {
              sentAt: "desc",
            },
          });

          const matchedIds = candidates
            .filter((item) =>
              matchesDecisionFilter(
                item.lenderReviews?.[0]?.reviewStatus ?? null,
                decisionFilter,
              ),
            )
            .map((item) => item.id);

          total = matchedIds.length;
          totalPages = Math.max(Math.ceil(total / limit) || 1, 1);
          safePage = Math.min(page, totalPages);
          const safeSkip = (safePage - 1) * limit;
          pageIds = matchedIds.slice(safeSkip, safeSkip + limit);
        } else {
          total = await prisma.applicationLender.count({ where: baseWhere });
          totalPages = Math.max(Math.ceil(total / limit) || 1, 1);
          safePage = Math.min(page, totalPages);
          const safeSkip = (safePage - 1) * limit;

          const pageRows = await prisma.applicationLender.findMany({
            where: baseWhere,
            select: { id: true },
            orderBy: { sentAt: "desc" },
            skip: safeSkip,
            take: limit,
          });

          pageIds = pageRows.map((row) => row.id);
        }

        const applications =
          pageIds.length === 0
            ? []
            : await prisma.applicationLender.findMany({
                where: {
                  id: { in: pageIds },
                },
                select: PAGE_LIST_SELECT,
              });

        const byId = new Map(applications.map((item) => [item.id, item]));
        const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean);
        const formatted = ordered.map(formatPipelineRow);

        return reply.send({
          success: true,
          page: safePage,
          limit,
          total,
          totalPages,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Server error while fetching applications",
        });
      }
    },
  );
}

module.exports = listSubmittedApplications;
