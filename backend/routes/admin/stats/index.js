const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  ANALYTICS_APPLICATION_SELECT,
  createAnalyticsEngine,
} = require("../../../utils/broker/dashboardPeriodAnalytics");

function normalizeGroupCount(rows = []) {
  return rows.map((row) => {
    const raw = row._count;
    const count =
      typeof raw === "number"
        ? raw
        : Number(raw?._all ?? raw?.id ?? 0) || 0;
    return { ...row, _count: count };
  });
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminStatsRoutes(fastify) {
  await fastify.register(require("./latestApplications"));

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Dashboard Stats"],
        summary: "Get Complete Admin Analytics Dashboard",
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
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const now = new Date();
        const last7Days = new Date();
        last7Days.setDate(now.getDate() - 7);

        const last30Days = new Date();
        last30Days.setDate(now.getDate() - 30);

        const engine = createAnalyticsEngine(request.query?.period);
        const { period, previousPeriod } = engine;

        const [
          totalOrganizations,
          orgByType,
          totalUsers,
          activeUsers,
          totalClients,
          activeClients,
          totalApplications,
          applicationStatusCounts,
          fundedVolume,
          applicationsLast7Days,
          applicationsLast30Days,
          totalLenderProducts,
          totalApplicationLenders,
          lenderStatusCounts,
          totalLenderReviews,
          conditionalApprovals,
          totalRuleEvaluations,
          failedRules,
          totalDocumentUploads,
          activeBrokerLenderLinks,
          totalClmLeads,
          totalLandingLeads,
          totalAdminLeads,
          totalLoanOfficers,
          totalSubBrokers,
          totalConversations,
        ] = await Promise.all([
          prisma.organization.count({ where: { isDeleted: false } }),
          prisma.organization.groupBy({
            by: ["type"],
            _count: { _all: true },
          }),
          prisma.userAccount.count({ where: { isDeleted: false } }),
          prisma.userAccount.count({
            where: { status: "ACTIVE", isDeleted: false },
          }),
          prisma.client.count({ where: { isDeleted: false } }),
          prisma.client.count({ where: { isActive: true, isDeleted: false } }),
          prisma.loanApplication.count(),
          prisma.loanApplication.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
          prisma.loanApplication.aggregate({
            _sum: {
              amountRequested: true,
            },
            where: { status: "FUNDED" },
          }),
          prisma.loanApplication.count({
            where: { createdAt: { gte: last7Days } },
          }),
          prisma.loanApplication.count({
            where: { createdAt: { gte: last30Days } },
          }),
          prisma.lenderProduct.count({ where: { isActive: true } }),
          prisma.applicationLender.count(),
          prisma.applicationLender.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
          prisma.lenderReview.count(),
          prisma.lenderReview.count({ where: { reviewStatus: "CONDITIONAL" } }),
          prisma.applicationRuleEvaluation.count(),
          prisma.applicationRuleResult.count({ where: { passed: false } }),
          prisma.applicationDocumentUpload.count(),
          prisma.brokerLenderAccess.count({ where: { isActive: true } }),
          prisma.commercialLendingMasteryLead.count(),
          prisma.clmLandingPageLead.count(),
          prisma.adminManualLead.count(),
          prisma.userAccount.count({
            where: {
              isDeleted: false,
              roles: { some: { role: { name: "BROKER_OFFICER" } } },
            },
          }),
          prisma.userAccount.count({
            where: {
              isDeleted: false,
              roles: { some: { role: { name: "SUB_BROKER" } } },
            },
          }),
          prisma.conversation.count(),
        ]);

        const applicationWhere = {
          OR: [
            {
              createdAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
            {
              submittedAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
            {
              fundedAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
          ],
        };

        const BATCH_SIZE = 500;
        let cursorId = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const batch = await prisma.loanApplication.findMany({
            where: applicationWhere,
            take: BATCH_SIZE,
            ...(cursorId
              ? {
                  skip: 1,
                  cursor: { id: cursorId },
                }
              : {}),
            orderBy: { id: "asc" },
            select: ANALYTICS_APPLICATION_SELECT,
          });

          if (!batch.length) break;

          for (const application of batch) {
            engine.add(application);
          }

          cursorId = batch[batch.length - 1].id;
          if (batch.length < BATCH_SIZE) break;
        }

        const analytics = engine.finalize();

        adminLogs.info("Improved full admin dashboard analytics fetched", {
          period: analytics.period?.key,
        });

        return reply.status(200).send({
          success: true,
          data: {
            organizations: {
              total: totalOrganizations,
              breakdown: normalizeGroupCount(orgByType),
            },
            users: {
              total: totalUsers,
              active: activeUsers,
              loanOfficers: totalLoanOfficers,
              subBrokers: totalSubBrokers,
            },
            conversations: {
              total: totalConversations,
            },
            clients: {
              total: totalClients,
              active: activeClients,
            },
            applications: {
              total: totalApplications,
              breakdown: normalizeGroupCount(applicationStatusCounts),
              fundedVolume: Number(fundedVolume._sum.amountRequested || 0),
              last7Days: applicationsLast7Days,
              last30Days: applicationsLast30Days,
            },
            lenders: {
              products: totalLenderProducts,
              connections: totalApplicationLenders,
              breakdown: normalizeGroupCount(lenderStatusCounts),
              reviews: totalLenderReviews,
              conditionalApprovals,
            },
            ruleEngine: {
              totalEvaluations: totalRuleEvaluations,
              failedRules,
            },
            documents: {
              totalUploads: totalDocumentUploads,
            },
            relationships: {
              activeBrokerLenderLinks,
            },
            leads: {
              commercialMastery: totalClmLeads,
              landingPage: totalLandingLeads,
              adminManual: totalAdminLeads,
            },
            analytics,
          },
        });
      } catch (error) {
        adminLogs.error("Fetching full admin stats failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while retrieving statistics",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    },
  );
}

module.exports = adminStatsRoutes;
