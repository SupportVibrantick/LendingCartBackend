async function clientNotificationRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./markRead"));
  fastify.register(require("./markAllRead"));
}

module.exports = clientNotificationRoutes;
