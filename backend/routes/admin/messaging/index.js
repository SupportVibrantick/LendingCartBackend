async function messagingRoutes(fastify) {
  fastify.register(require("./list"));
}

module.exports = messagingRoutes;
