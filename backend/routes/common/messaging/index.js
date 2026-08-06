/**
 * Messaging Routes Index
 * Registers all messaging-related routes
 */

module.exports = async function messagingRoutes(fastify) {
  /* ===============================
     Conversation Routes
  =============================== */

  await fastify.register(
    require("./conversation/getConversations"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/getInbox"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/getConversationById"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/createConversation"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/createLenderConversation"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/createNetworkConversation"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/createBrokerOfficerConversation"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/createClientOfficerConversation"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./conversation/markAsRead"),
    { prefix: "/" }
  );

   await fastify.register(
    require("./conversation/unReadCount"),
    { prefix: "/" }
  );

  // /* ===============================
  //    Message Routes
  // =============================== */

  await fastify.register(
    require("./message/getMessages"),
    { prefix: "/" }
  );

  await fastify.register(
    require("./message/sendMessage"),
    { prefix: "/" }
  );
};