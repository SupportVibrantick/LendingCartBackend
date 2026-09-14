const { adminLogs } = require("../../../services/logger/contextLogger.js");

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
            _count: true,
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
            _count: true,
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
            _count: true,
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

        adminLogs.info("Improved full admin dashboard analytics fetched");

        return reply.status(200).send({
          success: true,
          data: {
            organizations: {
              total: totalOrganizations,
              breakdown: orgByType,
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
              breakdown: applicationStatusCounts,
              fundedVolume: fundedVolume._sum.amountRequested || 0,
              last7Days: applicationsLast7Days,
              last30Days: applicationsLast30Days,
            },
            lenders: {
              products: totalLenderProducts,
              connections: totalApplicationLenders,
              breakdown: lenderStatusCounts,
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
