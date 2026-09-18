const {
  consolidateApplicationLenders,
  percentage,
  resolvePeriod,
  filterAppsInPeriod,
  changePercent,
} = require("./dashboardAnalytics");

function buildOverviewFromApps(applications, extras = {}) {
  const totalApplications = applications.length;

  const pendingReview = applications.filter(
    (item) => item.effectiveStatus === "IN_REVIEW",
  ).length;

  const approved = applications.filter(
    (item) => item.effectiveStatus === "APPROVED",
  ).length;

  const declined = applications.filter(
    (item) => item.effectiveStatus === "DECLINED",
  ).length;

  const fundedLoans = applications.filter(
    (item) => item.effectiveStatus === "FUNDED",
  ).length;

  const sentToLender = applications.filter(
    (item) => item.effectiveStatus !== "WITHDRAWN",
  ).length;

  const totalFundedVolume = applications
    .filter((item) => item.effectiveStatus === "FUNDED")
    .reduce((sum, item) => sum + Number(item.amountRequested || 0), 0);

  const totalRequestedVolume = applications.reduce(
    (sum, item) => sum + Number(item.amountRequested || 0),
    0,
  );

  const avgLoanSize =
    totalApplications > 0
      ? Number((totalRequestedVolume / totalApplications).toFixed(2))
      : 0;

  const uniqueBrokerIds = [
    ...new Set(
      applications
        .map((item) => item.loanApplication?.brokerOrgId)
        .filter(Boolean),
    ),
  ];

  return {
    totalApplications,
    pendingReview,
    approved,
    declined,
    fundedLoans,
    totalFundedVolume,
    avgLoanSize,
    sentToLender,
    fundedRate: percentage(fundedLoans, totalApplications, 0),
    activeBrokers: uniqueBrokerIds.length,
    approvalRate: percentage(approved + fundedLoans, totalApplications, 0),
    ...extras,
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getOverviewStats(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Dashboard"],
        summary: "Lender overview stats",
        querystring: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["7d", "30d", "90d", "12m"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const period = resolvePeriod(req.query?.period);

        const [applicationLenders, activeProducts, activeConnections] =
          await Promise.all([
            fastify.prisma.applicationLender.findMany({
              where: { lenderOrgId },
              select: {
                loanApplicationId: true,
                status: true,
                sentAt: true,
                lastUpdatedAt: true,
                loanApplication: {
                  select: {
                    id: true,
                    brokerOrgId: true,
                    status: true,
                    amountRequested: true,
                    createdAt: true,
                  },
                },
              },
            }),
            fastify.prisma.lenderProduct.count({
              where: { lenderOrgId, isActive: true },
            }),
            fastify.prisma.brokerLenderAccess.count({
              where: { lenderOrgId, isActive: true },
            }),
          ]);

        const consolidated =
          consolidateApplicationLenders(applicationLenders);
        const currentApps = filterAppsInPeriod(
          consolidated,
          period.start,
          period.end,
        );
        const previousApps = filterAppsInPeriod(
          consolidated,
          period.previousStart,
          period.previousEnd,
        );

        const current = buildOverviewFromApps(currentApps, {
          activeProducts,
          activeConnections,
        });
        const previous = buildOverviewFromApps(previousApps);

        const comparisonFields = [
          "totalApplications",
          "pendingReview",
          "approved",
          "declined",
          "fundedLoans",
          "totalFundedVolume",
          "activeBrokers",
        ];

        const comparison = Object.fromEntries(
          comparisonFields.map((field) => {
            const currentValue = current[field] || 0;
            const previousValue = previous[field] || 0;
            return [
              field,
              {
                current: currentValue,
                previous: previousValue,
                changePercent: changePercent(currentValue, previousValue),
              },
            ];
          }),
        );

        return reply.send({
          success: true,
          data: {
            ...current,
            comparison,
            period: {
              key: period.key,
              start: period.start.toISOString(),
              end: period.end.toISOString(),
              granularity: period.granularity,
            },
          },
        });
      } catch (error) {
        fastify.log.error({
          route: "lender-overview-stats",
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to fetch dashboard stats",
        });
      }
    },
  );
};
