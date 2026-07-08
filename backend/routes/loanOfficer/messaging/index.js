const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

module.exports = async function messagingRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  await fastify.register(require("./conversation/getConversations"), { prefix: "/" });
  await fastify.register(require("./conversation/getConversationById"), { prefix: "/" });
  await fastify.register(require("./conversation/createConversation"), { prefix: "/" });
  await fastify.register(require("./conversation/createBrokerOfficerConversation"), { prefix: "/" });
  await fastify.register(require("./conversation/markAsRead"), { prefix: "/" });
  await fastify.register(require("./conversation/unReadCount"), { prefix: "/" });
  await fastify.register(require("./message/getMessages"), { prefix: "/" });
  await fastify.register(require("./message/sendMessage"), { prefix: "/" });
};
