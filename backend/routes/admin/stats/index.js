const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminStatsRoutes(fastify) {
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
          // ORGANIZATIONS
          totalOrganizations,
          orgByType,

          // USERS
          totalUsers,
          activeUsers,

          // CLIENTS
          totalClients,
          activeClients,

          // APPLICATIONS
          totalApplications,
          applicationStatusCounts,
          fundedVolume,

          applicationsLast7Days,
          applicationsLast30Days,

          // LENDER
          totalLenderProducts,
          totalApplicationLenders,
          lenderStatusCounts,
          totalLenderReviews,
          conditionalApprovals,

          // RULE ENGINE
          totalRuleEvaluations,
          failedRules,

          // DOCUMENTS
          totalDocumentUploads,

          // RELATIONSHIPS
          activeBrokerLenderLinks,

          // LEADS
          totalClmLeads,
          totalLandingLeads,
          totalAdminLeads,

          // 🔥 LATEST APPLICATIONS
          latestApplications,

        ] = await Promise.all([

          // ORGANIZATIONS
          prisma.organization.count({ where: { isDeleted: false } }),
          prisma.organization.groupBy({
            by: ["type"],
            _count: true,
          }),

          // USERS
          prisma.userAccount.count({ where: { isDeleted: false } }),
          prisma.userAccount.count({ where: { status: "ACTIVE", isDeleted: false } }),

          // CLIENTS
          prisma.client.count({ where: { isDeleted: false } }),
          prisma.client.count({ where: { isActive: true, isDeleted: false } }),

          // APPLICATIONS
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

          prisma.loanApplication.count({ where: { createdAt: { gte: last7Days } } }),
          prisma.loanApplication.count({ where: { createdAt: { gte: last30Days } } }),

          // LENDER
          prisma.lenderProduct.count({ where: { isActive: true } }),
          prisma.applicationLender.count(),
          prisma.applicationLender.groupBy({
            by: ["status"],
            _count: true,
          }),
          prisma.lenderReview.count(),
          prisma.lenderReview.count({ where: { reviewStatus: "CONDITIONAL" } }),

          // RULE ENGINE
          prisma.applicationRuleEvaluation.count(),
          prisma.applicationRuleResult.count({ where: { passed: false } }),

          // DOCUMENTS
          prisma.applicationDocumentUpload.count(),

          // RELATIONSHIPS
          prisma.brokerLenderAccess.count({ where: { isActive: true } }),

          // LEADS
          prisma.commercialLendingMasteryLead.count(),
          prisma.clmLandingPageLead.count(),
          prisma.adminManualLead.count(),

          // 🔥 LATEST APPLICATIONS (Top 10)
          prisma.loanApplication.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              applicationNumber: true,
              status: true,
              loanProductCode: true,
              amountRequested: true,
              createdAt: true,
              brokerOrg: { select: { name: true } },
              client: { select: { legalName: true } },
              applicationLenders: { select: { id: true } },
            },
          }),
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

            latestApplications: latestApplications.map(app => ({
              id: app.id,
              applicationNumber: app.applicationNumber,
              status: app.status,
              product: app.loanProductCode,
              amount: app.amountRequested,
              brokerName: app.brokerOrg?.name || null,
              clientName: app.client?.legalName || null,
              lenderCount: app.applicationLenders.length,
              createdAt: app.createdAt,
            })),
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
    }
  );
}

module.exports = adminStatsRoutes;