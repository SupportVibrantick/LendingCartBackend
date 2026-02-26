/**
 * @param {import("fastify").FastifyInstance} fastify
 */
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
        // 1️⃣ AUTH CHECK
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
        // 2️⃣ PAGINATION + FILTERS
        // ==========================================
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const decisionFilter = req.query.decision;

        // ==========================================
        // 3️⃣ FETCH APPLICATIONS
        // ==========================================
        const applications = await prisma.applicationLender.findMany({
          where: {
            lenderOrgId,
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
        // 4️⃣ FORMAT RESPONSE
        // ==========================================
        const formatted = applications
          .map((item) => {
            const app = item.loanApplication;
            const latestReview = item.lenderReviews?.[0] ?? null;

            let amountRequested = null;
            let termMonthsRequested = null;

            if (app.submissions?.length) {
              const fields = app.submissions[0].fields || [];

              const getField = (key) =>
                fields.find((f) => f.fieldKey === key)?.value;

              amountRequested = Number(getField("amountRequested")) || null;

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

            // 🔥 Pending Document Count
            const pendingDocumentsCount =
              app.documentRequirements?.filter(
                (doc) => doc.status !== "COMPLETE"
              ).length || 0;

            return {
              applicationLenderId: item.id,

              // Pipeline vs Decision
              lenderPipelineStatus: item.status,
              lenderDecision: latestReview?.reviewStatus ?? null,

              approvedAmount: latestReview?.approvedAmount ?? null,
              interestRate: latestReview?.interestRate ?? null,

              sentAt: item.sentAt,

              applicationId: app.id,
              applicationNumber: app.applicationNumber,
              loanProductCode: app.loanProductCode,
              amountRequested,
              termMonthsRequested,
              applicationStatus: app.status,
              createdAt: app.createdAt,

              // ✅ Added here
              pendingDocumentsCount,

              client: app.client,
              broker: app.brokerOrg,
            };
          })
          .filter((item) =>
            decisionFilter
              ? item.lenderDecision === decisionFilter
              : true
          );

        // ==========================================
        // 5️⃣ TOTAL COUNT
        // ==========================================
        const total = await prisma.applicationLender.count({
          where: { lenderOrgId },
        });

        // ==========================================
        // 6️⃣ RESPONSE
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
    }
  );
}

module.exports = listSubmittedApplications;