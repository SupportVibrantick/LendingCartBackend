/**
 * Send message in a sub-broker conversation
 */

const { emitRealtimeMessage } = require("../../../../services/messagingAccess");

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
      const { type, text, fileUrl, fileName, fileSize, mimeType, metadata } = req.body;
      const userId = req.user?.userId;

      try {
        if (type === "TEXT" && !text?.trim()) {
          return reply.code(400).send({
            success: false,
            message: "Text message cannot be empty",
          });
        }

        if (type === "FILE" && !fileUrl) {
          return reply.code(400).send({
            success: false,
            message: "File URL is required",
          });
        }

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId,
            participantId: userId,
            participantType: "SUB_BROKER",
          },
        });

        if (!participant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const sender = await prisma.userAccount.findUnique({
          where: {
            id: userId,
          },
          select: {
            firstName: true,
            lastName: true,
          },
        });

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderType: "SUB_BROKER",
            senderUserId: userId,
            senderName:
              `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() ||
              "Sub Broker",
            type,
            text: type === "TEXT" ? text.trim() : null,
            fileUrl: type === "FILE" ? fileUrl : null,
            fileName: type === "FILE" ? fileName : null,
            fileSize: type === "FILE" ? Math.round(fileSize || 0) : null,
            mimeType: type === "FILE" ? mimeType : null,
            metadata: metadata || null,
          },
        });

        await prisma.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            lastMessageAt: message.createdAt,
          },
        });

        await emitRealtimeMessage(fastify.io, prisma, { ...message, conversationId }, conversationId);

        return reply.send({
          success: true,
          data: {
            id: message.id,
            type: message.type,
            text: message.text,
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileSize: message.fileSize,
            mimeType: message.mimeType,
            metadata: message.metadata,
            senderType: message.senderType,
            senderUserId: message.senderUserId,
            senderName: message.senderName,
            createdAt: message.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId,
          },
          "Failed to send sub-broker message"
        );

        return reply.code(500).send({
          success: false,
         message: error.message,
        });
      }
    }
  );
};
