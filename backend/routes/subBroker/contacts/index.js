async function subBrokerContactsRoutes(fastify) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(["SUB_BROKER"]));

  await fastify.register(require("./create"));
  await fastify.register(require("./list"));
  await fastify.register(require("./delete"));
  await fastify.register(require("./update"));
}

module.exports = subBrokerContactsRoutes;
