const {
  fetchCoBrokerPipelineStats,
} = require("../../../utils/broker/coBrokerDashboardData");

module.exports = async function subBrokerPipelineStats(fastify) {
  fastify.get(
    "/pipeline-stats",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Loan Pipeline"],
        summary: "Pipeline analytics for assigned co-broker applications",
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
        const prisma = fastify.prisma;
        const userId = req.user.userId || req.user.id;
        const orgId = req.user.organizationId;

        const data = await fetchCoBrokerPipelineStats(prisma, {
          userId,
          orgId,
          period: req.query?.period || "12m",
        });

        return reply.send({
          success: true,
          data,
        });
      } catch (error) {
        req.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch pipeline stats",
        });
      }
    },
  );
};
