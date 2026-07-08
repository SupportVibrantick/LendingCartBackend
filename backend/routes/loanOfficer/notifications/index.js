const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerNotificationRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  fastify.register(require("../../broker/notifications/list"));
  fastify.register(require("../../broker/notifications/markRead"));
  fastify.register(require("../../broker/notifications/markAllRead"));
  fastify.register(require("../../broker/notifications/delete"));
  fastify.register(require("../../broker/notifications/deleteAll"));
}

module.exports = loanOfficerNotificationRoutes;
