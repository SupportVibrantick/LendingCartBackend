async function subBrokerLenderDiscoveryRoutes(fastify) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(["SUB_BROKER"]));

  await fastify.register(require("./findEligible"));
  await fastify.register(require("./sendToLenders"));
}

module.exports = subBrokerLenderDiscoveryRoutes;
