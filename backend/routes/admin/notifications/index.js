async function adminNotificationRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./markAllRead"));
  fastify.register(require("./markRead"));
  fastify.register(require("./deleteAll"));
  fastify.register(require("./delete"));
}

module.exports = adminNotificationRoutes;
