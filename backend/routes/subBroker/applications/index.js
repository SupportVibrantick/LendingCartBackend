async function subBrokerApplicationsRoutes(fastify) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(["SUB_BROKER"]));

  await fastify.register(require("./submit"));
  await fastify.register(require("./activeApplication"));
  await fastify.register(require("./editSubmittedApplication"));
}

module.exports = subBrokerApplicationsRoutes;
