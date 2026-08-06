const {
  fetchActiveBrokerApplication,
  formatActiveApplicationResponse,
} = require("../../../utils/broker/activeBrokerApplication");

module.exports = async function subBrokerActiveApplication(fastify) {
  fastify.get(
    "/active",
    {
      schema: {
        tags: ["Sub Broker -> Applications"],
        summary: "Get active broker application form for co-broker",
      },
    },
    async (req, reply) => {
      const brokerOrgId = req.user.organizationId;

      if (!brokerOrgId) {
        return reply.code(403).send({
          success: false,
          message: "Broker context not resolved",
        });
      }

      const application = await fetchActiveBrokerApplication(
        fastify.prisma,
        brokerOrgId,
      );

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "No active application found",
        });
      }

      return reply.send({
        success: true,
        data: formatActiveApplicationResponse(application),
      });
    },
  );
};
