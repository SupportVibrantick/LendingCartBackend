/**
 * Send message in a conversation (loan officer)
 */

const {
  sendConversationMessage,
} = require("../../../../services/messaging/sendConversationMessage");
const {
  extraOfficerPermission,
  LOAN_OFFICER_MESSAGING_PERMISSIONS,
} = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function sendMessage(fastify) {
  fastify.post(
    "/conversation/:conversationId/message",
    {
      preHandler: extraOfficerPermission(
        fastify,
        LOAN_OFFICER_MESSAGING_PERMISSIONS,
      ),
      schema: {
        tags: ["Messaging"],
        summary: "Send message",
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
            userId: req.user?.id || req.user?.userId || req.user?.clientId,
          },
          "Failed to send message",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
