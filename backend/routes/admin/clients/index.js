async function clientRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./status"));
}

module.exports = clientRoutes;
