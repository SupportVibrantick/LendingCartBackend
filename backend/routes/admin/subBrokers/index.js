async function subBrokerRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./status"));
}

module.exports = subBrokerRoutes;
