/**
 * Messaging Routes Index
 * Registers all sub-broker messaging routes
 */

module.exports = async function messagingRoutes(fastify) {
  await fastify.register(require("./conversation/getConversations"), {
    prefix: "/",
  });

  await fastify.register(require("./conversation/getConversationById"), {
    prefix: "/",
  });

  await fastify.register(require("./conversation/createConversation"), {
    prefix: "/",
  });

  await fastify.register(require("./conversation/markAsRead"), {
    prefix: "/",
  });

  await fastify.register(require("./conversation/unReadCount"), {
    prefix: "/",
  });

  await fastify.register(require("./message/getMessages"), {
    prefix: "/",
  });

  await fastify.register(require("./message/sendMessage"), {
    prefix: "/",
  });
};
