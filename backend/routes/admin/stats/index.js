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
        const last7Days = new Date(now);
        last7Days.setDate(now.getDate() - 7);

        const last30Days = new Date(now);
        last30Days.setDate(now.getDate() - 30);

        const [
          // ORGANIZATIONS
          totalBrokers,
          activeBrokers,
          totalLenders,
          activeLenders,

          // USERS
          totalUsers,
          activeUsers,

          // CLIENTS
          totalClients,
          activeClients,

          // APPLICATIONS
          totalApplications,
          draftApplications,
          submittedApplications,
          inReviewApplications,
          approvedApplications,
          declinedApplications,
          fundedApplications,
          withdrawnApplications,

          // RECENT ACTIVITY
          applicationsLast7Days,
          applicationsLast30Days,

          // LENDER STATS
          totalLenderProducts,
          totalApplicationLenders,
          approvedByLenders,
          declinedByLenders,

          // RULE ENGINE
          totalRuleEvaluations,
          hardFailRules,
          softFailRules,

          // DOCUMENTS
          totalDocumentUploads,

          // BROKER-LENDER RELATIONS
          activeBrokerLenderLinks,

          // REVIEWS
          totalLenderReviews,
          conditionalApprovals,

        ] = await Promise.all([

          // ORGANIZATIONS
          prisma.organization.count({ where: { type: "BROKER", isDeleted: false } }),
          prisma.organization.count({ where: { type: "BROKER", status: "ACTIVE", isDeleted: false } }),
          prisma.organization.count({ where: { type: "LENDER", isDeleted: false } }),
          prisma.organization.count({ where: { type: "LENDER", status: "ACTIVE", isDeleted: false } }),

          // USERS
          prisma.userAccount.count({ where: { isDeleted: false } }),
          prisma.userAccount.count({ where: { status: "ACTIVE", isDeleted: false } }),

          // CLIENTS
          prisma.client.count({ where: { isDeleted: false } }),
          prisma.client.count({ where: { isActive: true, isDeleted: false } }),

          // APPLICATIONS
          prisma.loanApplication.count(),
          prisma.loanApplication.count({ where: { status: "DRAFT" } }),
          prisma.loanApplication.count({ where: { status: "SUBMITTED" } }),
          prisma.loanApplication.count({ where: { status: "IN_REVIEW" } }),
          prisma.loanApplication.count({ where: { status: "LENDER_APPROVED" } }),
          prisma.loanApplication.count({ where: { status: "LENDER_DECLINED" } }),
          prisma.loanApplication.count({ where: { status: "FUNDED" } }),
          prisma.loanApplication.count({ where: { status: "WITHDRAWN" } }),

          // RECENT ACTIVITY
          prisma.loanApplication.count({ where: { createdAt: { gte: last7Days } } }),
          prisma.loanApplication.count({ where: { createdAt: { gte: last30Days } } }),

          // LENDER STATS
          prisma.lenderProduct.count({ where: { isActive: true } }),
          prisma.applicationLender.count(),
          prisma.applicationLender.count({ where: { status: "APPROVED" } }),
          prisma.applicationLender.count({ where: { status: "DECLINED" } }),

          // RULE ENGINE
          prisma.applicationRuleEvaluation.count(),
          prisma.applicationRuleResult.count({
            where: { passed: false }
          }),
          prisma.applicationRuleResult.count({
            where: { passed: true }
          }),

          // DOCUMENTS
          prisma.applicationDocumentUpload.count(),

          // BROKER-LENDER RELATIONS
          prisma.brokerLenderAccess.count({ where: { isActive: true } }),

          // REVIEWS
          prisma.lenderReview.count(),
          prisma.lenderReview.count({ where: { reviewStatus: "CONDITIONAL" } }),
        ]);

        adminLogs.info("Full admin dashboard analytics fetched");

        return reply.status(200).send({
          success: true,
          data: {

            organizations: {
              brokers: totalBrokers,
              activeBrokers,
              lenders: totalLenders,
              activeLenders,
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
              draft: draftApplications,
              submitted: submittedApplications,
              inReview: inReviewApplications,
              approved: approvedApplications,
              declined: declinedApplications,
              funded: fundedApplications,
              withdrawn: withdrawnApplications,
              last7Days: applicationsLast7Days,
              last30Days: applicationsLast30Days,
            },

            lenders: {
              products: totalLenderProducts,
              applicationConnections: totalApplicationLenders,
              approved: approvedByLenders,
              declined: declinedByLenders,
              reviews: totalLenderReviews,
              conditionalApprovals,
            },

            ruleEngine: {
              totalEvaluations: totalRuleEvaluations,
              hardFails: hardFailRules,
              softPasses: softFailRules,
            },

            documents: {
              totalUploads: totalDocumentUploads,
            },

            relationships: {
              activeBrokerLenderLinks,
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
    }
  );
}

module.exports = adminStatsRoutes;