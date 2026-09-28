const { sendOrgEntitlements } = require("../common/sendOrgEntitlements");

async function subBrokerEntitlementsRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["SUB_BROKER"]),
      ],
      schema: {
        tags: ["Sub Broker -> Entitlements"],
        summary:
          "Get org feature entitlements for the co-broker's broker org",
      },
    },
    async (req, reply) => sendOrgEntitlements(fastify, req, reply),
  );
}

module.exports = subBrokerEntitlementsRoutes;
