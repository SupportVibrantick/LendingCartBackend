/**
 * @param {import("fastify").FastifyInstance} fastify
 */
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
        const skip = (page - 1) * limit;
        const decisionFilter = req.query.decision || null;
        const search =
          typeof req.query.search === "string"
            ? req.query.search.trim()
            : "";

        const baseWhere = {
          lenderOrgId,
          ...buildSearchWhere(search || null),
        };

        // Resolve decision against the latest review, then paginate.
        // (Prisma cannot easily filter by "latest related row" in one query.)
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

        const total = matchedIds.length;
        const totalPages = Math.max(Math.ceil(total / limit) || 1, 1);
        const safePage = Math.min(page, totalPages);
        const safeSkip = (safePage - 1) * limit;
        const pageIds = matchedIds.slice(safeSkip, safeSkip + limit);

        const applications =
          pageIds.length === 0
            ? []
            : await prisma.applicationLender.findMany({
                where: {
                  id: { in: pageIds },
                },
                include: {
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
                    include: {
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
                        take: 1,
                        include: {
                          fields: true,
                        },
                      },
                      documentRequirements: {
                        select: {
                          status: true,
                        },
                      },
                    },
                  },
                },
              });

        const byId = new Map(applications.map((item) => [item.id, item]));
        const ordered = pageIds
          .map((id) => byId.get(id))
          .filter(Boolean);

        const formatted = ordered.map((item) => {
          const app = item.loanApplication;
          const latestReview = item.lenderReviews?.[0] ?? null;
          const fields = app.submissions?.[0]?.fields || [];
          const borrowerFirstName = normalizeText(
            getFieldValue(
              fields,
              "borrowerFirstName",
              "firstName",
              "first_name",
            ),
          );
          const borrowerLastName = normalizeText(
            getFieldValue(
              fields,
              "borrowerLastName",
              "lastName",
              "last_name",
            ),
          );

          let amountRequested = null;
          let termMonthsRequested = null;

          if (app.submissions?.length) {
            const getField = (...keys) => getFieldValue(fields, ...keys);

            amountRequested =
              Number(getField("amountRequested", "loan_amount")) || null;

            const minTerm = Number(getField("minTermMonths"));
            const maxTerm = Number(getField("maxTermMonths"));
            const termYears = Number(getField("requested_term_years"));

            if (maxTerm) {
              termMonthsRequested = maxTerm;
            } else if (termYears) {
              termMonthsRequested = termYears * 12;
            } else if (minTerm) {
              termMonthsRequested = minTerm;
            }
          }

          const pendingDocumentsCount =
            app.documentRequirements?.filter(
              (doc) => doc.status !== "COMPLETE",
            ).length || 0;

          const lenderDecision = latestReview?.reviewStatus ?? null;

          return {
            applicationLenderId: item.id,
            loiUrl: item.loiUrl,
            loiGenerated: !!item.loiUrl,
            loiSentToBroker: !!item.loiSentToBrokerAt,
            loiSentToBrokerAt: item.loiSentToBrokerAt,
            lenderPipelineStatus: item.status,
            lenderDecision,
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
            termMonthsRequested,
            applicationStatus: app.status,
            createdAt: app.createdAt,
            pendingDocumentsCount,
            client: app.client,
            broker: app.brokerOrg,
          };
        });

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
