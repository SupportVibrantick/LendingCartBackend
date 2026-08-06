const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

module.exports = async function messagingRoutes(fastify) {
  // Auth + role only; per-route permission (read vs send) applied in handlers.
  registerOfficerRouteGuards(fastify);

  await fastify.register(require("./conversation/getConversations"), { prefix: "/" });
  await fastify.register(require("./conversation/getConversationById"), { prefix: "/" });
  await fastify.register(require("./conversation/createConversation"), { prefix: "/" });
  await fastify.register(require("./conversation/createBrokerOfficerConversation"), { prefix: "/" });
  await fastify.register(require("./conversation/markAsRead"), { prefix: "/" });
  await fastify.register(require("./conversation/unReadCount"), { prefix: "/" });
  await fastify.register(require("./message/getMessages"), { prefix: "/" });
  await fastify.register(require("./message/sendMessage"), { prefix: "/" });
};
