const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerNotificationRoutes(fastify) {
  registerOfficerRouteGuards(fastify, "SEND_NOTIFICATIONS");

  await fastify.register(require("../../broker/notifications/list"));
  await fastify.register(require("../../broker/notifications/markRead"));
  await fastify.register(require("../../broker/notifications/markAllRead"));
  await fastify.register(require("../../broker/notifications/delete"));
  await fastify.register(require("../../broker/notifications/deleteAll"));
}

module.exports = loanOfficerNotificationRoutes;
