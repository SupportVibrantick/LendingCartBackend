/**
 * Send message in a sub-broker conversation
 */

const {
  sendConversationMessage,
} = require("../../../../services/messaging/sendConversationMessage");

module.exports = async function sendMessage(fastify) {
  fastify.post(
    "/conversation/:conversationId/message",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Send message in a sub-broker conversation",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["TEXT", "FILE", "SYSTEM"],
            },
            text: { type: "string" },
            fileUrl: { type: "string" },
            fileName: { type: "string" },
            fileSize: { type: "number" },
            mimeType: { type: "string" },
            metadata: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;

      try {
        const result = await sendConversationMessage(
          prisma,
          fastify.io,
          req,
          {
            conversationId,
            ...req.body,
          },
        );

        return reply.code(result.statusCode).send(result.body);
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.userId,
          },
          "Failed to send sub-broker message",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
