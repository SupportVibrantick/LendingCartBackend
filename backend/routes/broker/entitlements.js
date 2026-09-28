const { sendOrgEntitlements } = require("../common/sendOrgEntitlements");

async function entitlementsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Entitlements"],
        summary: "Get org feature entitlements for the current broker",
      },
    },
    async (req, reply) => sendOrgEntitlements(fastify, req, reply),
  );
}

module.exports = entitlementsRoutes;
