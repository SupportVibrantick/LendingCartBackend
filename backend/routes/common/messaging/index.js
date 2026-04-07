/**
 * Messaging Routes Index
 * Registers all messaging-related APIs
 * @param {import("fastify").FastifyInstance} fastify
 */
async function messagingRoutes(fastify) {
  console.log("createConversation:", typeof require("./createConversation"));
  console.log("getConversations:", typeof require("./getConversations"));
  console.log("getMessages:", typeof require("./getMessages"));
  console.log("sendMessage:", typeof require("./sendMessage"));

  fastify.register(require("./createConversation"));
  fastify.register(require("./getConversations"));
  fastify.register(require("./getMessages"));
  fastify.register(require("./sendMessage"));
  fastify.register(require("./deleteConversation"));
}

module.exports = messagingRoutes;