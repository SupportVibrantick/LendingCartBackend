const { registerOfficerRouteGuards, extraOfficerPermission, getUserId } = require("../../../services/broker/loanOfficerAccess");
const {
  fetchLoanOfficerPipelineStats,
  fetchLoanOfficerRecentApplications,
} = require("../../../utils/broker/loanOfficerDashboardData");

const DASHBOARD_STATS_PERMISSIONS = "VIEW_DASHBOARD_STATS";
const DASHBOARD_RECENT_PERMISSIONS = "VIEW_DASHBOARD_RECENT";

async function loanOfficerDashboardRoutes(fastify) {
  registerOfficerRouteGuards(fastify);

  fastify.get(
    "/stats",
    {
      preHandler: extraOfficerPermission(fastify, DASHBOARD_STATS_PERMISSIONS),
      schema: {
        tags: ["Loan Officer -> Dashboard"],
        summary: "Pipeline stat cards for the officer dashboard",
      },
    },
    async (req, reply) => {
      try {
        const userId = getUserId(req);
        const orgId = req.user.organizationId;
        const data = await fetchLoanOfficerPipelineStats(fastify.prisma, {
          userId,
          orgId,
        });

        return reply.send({ success: true, data });
      } catch (error) {
        req.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to fetch dashboard stats",
        });
      }
    },
  );

  fastify.get(
    "/recent-applications",
    {
      preHandler: extraOfficerPermission(fastify, DASHBOARD_RECENT_PERMISSIONS),
      schema: {
        tags: ["Loan Officer -> Dashboard"],
        summary: "Recent assigned applications for the officer dashboard",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const userId = getUserId(req);
        const orgId = req.user.organizationId;
        const limit = Number(req.query?.limit) || 5;
        const data = await fetchLoanOfficerRecentApplications(fastify.prisma, {
          userId,
          orgId,
          limit,
        });

        return reply.send({ success: true, data });
      } catch (error) {
        req.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to fetch recent applications",
        });
      }
    },
  );
}

module.exports = loanOfficerDashboardRoutes;
