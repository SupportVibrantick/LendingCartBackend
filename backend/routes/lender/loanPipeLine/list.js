/**
 * @param {import("fastify").FastifyInstance} fastify
 */
function getFieldValue(fields = [], ...keys) {
  return fields.find((field) =>
    keys.includes(
      field.builderField?.fieldKey ||
        field.fieldKey,
    ),
  )?.value;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveBorrowerName(app) {
  const contact =
    app?.client?.contacts?.[0] || null;
  const fields =
    app?.submissions?.[0]?.fields || [];
  const borrowerFirstName =
    normalizeText(
      getFieldValue(
        fields,
        "borrowerFirstName",
        "firstName",
        "first_name",
      ),
    );
  const borrowerLastName =
    normalizeText(
      getFieldValue(
        fields,
        "borrowerLastName",
        "lastName",
        "last_name",
      ),
    );
  const fullNameFromFields = [
    borrowerFirstName,
    borrowerLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const clientLegalName = normalizeText(
    app?.client?.legalName,
  );

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
    ![
      "Applicant",
      "Individual Applicant",
    ].includes(clientLegalName)
      ? clientLegalName
      : null) ||
    "N/A"
  );
}

function resolveBorrowerEntityType(app) {
  const fields =
    app?.submissions?.[0]?.fields || [];

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
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            decision: {
              type: "string",
              enum: ["CONDITIONAL", "APPROVED", "DECLINED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ==========================================
        // AUTH CHECK
        // ==========================================
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

        // ==========================================
        // PAGINATION + FILTERS
        // ==========================================
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const decisionFilter = req.query.decision;
        const search = req.query.search?.trim();

        // ==========================================
        // FETCH APPLICATIONS
        // ==========================================
        const applications = await prisma.applicationLender.findMany({
          where: {
            lenderOrgId,
              ...(search && {
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
      legalName: {
        contains: search,
        mode: "insensitive",
      },
    },
  },
},
        ],
      },
    }),
  },
          orderBy: {
            sentAt: "desc",
          },
          skip,
          take: limit,
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

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================
        const formatted = applications
          .map((item) => {
            const app = item.loanApplication;
            const latestReview = item.lenderReviews?.[0] ?? null;
            const fields =
              app.submissions?.[0]?.fields ||
              [];
            const borrowerFirstName =
              normalizeText(
                getFieldValue(
                  fields,
                  "borrowerFirstName",
                  "firstName",
                  "first_name",
                ),
              );
            const borrowerLastName =
              normalizeText(
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
              const getField = (...keys) =>
                getFieldValue(
                  fields,
                  ...keys,
                );

              amountRequested =
                Number(
                  getField(
                    "amountRequested",
                    "loan_amount",
                  ),
                ) || null;

              const minTerm = Number(
                getField(
                  "minTermMonths",
                ),
              );
              const maxTerm = Number(
                getField(
                  "maxTermMonths",
                ),
              );
              const termYears = Number(
                getField(
                  "requested_term_years",
                ),
              );

              if (maxTerm) {
                termMonthsRequested = maxTerm;
              } else if (termYears) {
                termMonthsRequested = termYears * 12;
              } else if (minTerm) {
                termMonthsRequested = minTerm;
              }
            }

            // Pending Document Count
            const pendingDocumentsCount =
              app.documentRequirements?.filter(
                (doc) => doc.status !== "COMPLETE",
              ).length || 0;

            const lenderDecision = latestReview?.reviewStatus ?? null;
            const applicationStatus = app.status;

            return {
              applicationLenderId: item.id,

              loiUrl: item.loiUrl,
              loiGenerated: !!item.loiUrl,
              loiSentToBroker: !!item.loiSentToBrokerAt,
              loiSentToBrokerAt: item.loiSentToBrokerAt,
              // Pipeline vs Decision
              lenderPipelineStatus: item.status,
              lenderDecision,

              approvedAmount: latestReview?.approvedAmount ?? null,
              interestRate: latestReview?.interestRate ?? null,

              sentAt: item.sentAt,

              applicationId: app.id,
              applicationNumber: app.applicationNumber,
              borrowerFirstName,
              borrowerLastName,
              borrowerName:
                resolveBorrowerName(app),
              borrowerEntityType:
                resolveBorrowerEntityType(app),
              loanProductCode: app.loanProductCode,
              amountRequested,
              termMonthsRequested,
              applicationStatus,
              createdAt: app.createdAt,

              // Added here
              pendingDocumentsCount,

              client: app.client,
              broker: app.brokerOrg,
            };
          })
          .filter((item) =>
            decisionFilter ? item.lenderDecision === decisionFilter : true,
          );

        // ==========================================
        // TOTAL COUNT
        // ==========================================
     const total = await prisma.applicationLender.count({
  where: {
    lenderOrgId,

    ...(search && {
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
                legalName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
    }),
  },
});

        // ==========================================
        // RESPONSE
        // ==========================================
        return reply.send({
          success: true,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
