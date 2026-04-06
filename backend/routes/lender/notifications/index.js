async function lenderNotificationRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./markRead"));
  fastify.register(require("./markAllRead"));
  fastify.register(require("./delete"));
  fastify.register(require("./deleteAll"));
}

module.exports = lenderNotificationRoutes;