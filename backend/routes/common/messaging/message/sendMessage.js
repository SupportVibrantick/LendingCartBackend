/**
 * Send message in a conversation
 */

module.exports = async function sendMessage(fastify) {
  fastify.post(
    "/conversation/:conversationId/message",
    {
      preHandler: [fastify.authenticate],
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

      const {
        type,
        text,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        metadata,
      } = req.body;

      try {
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId =
          req.user?.id || req.user?.userId || req.user?.clientId;

        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        console.log("👤 Sender:", req.user);

        /* ================= VALIDATION ================= */

        if (type === "TEXT" && !text) {
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

        /* ================= VERIFY CONVERSATION ================= */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* ================= CHECK PARTICIPANT ================= */

        const participant =
          await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,
              participantId: userId,
            },
          });

        if (!participant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ================= DETERMINE SENDER ================= */

        let senderType = "CLIENT";
        let senderUserId = null;
        let senderClientUserId = null;

        if (req.user.orgType === "BROKER" || req.user.orgType === "LENDER") {
          senderType = req.user.orgType;
          senderUserId = userId;
        } else {
          senderType = "CLIENT";
          senderClientUserId = userId;
        }

        /* ================= CREATE MESSAGE ================= */

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderType,
            senderUserId,
            senderClientUserId,
            type,
            text: type === "TEXT" ? text : null,
            fileUrl: type === "FILE" ? fileUrl : null,
            fileName: type === "FILE" ? fileName : null,
            fileSize: type === "FILE" ? fileSize : null,
            mimeType: type === "FILE" ? mimeType : null,
            metadata: metadata || null,
          },
        });

        /* ================= UPDATE CONVERSATION ================= */

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
          },
        });

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          data: {
            id: message.id,
            type: message.type,
            text: message.text,
            senderType: message.senderType,
            senderUserId: message.senderUserId,
            senderClientUserId: message.senderClientUserId,
            createdAt: message.createdAt,
          },
        });

      } catch (error) {
        console.error("💥 SEND MESSAGE ERROR:", error.message);

        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId:
              req.user?.id ||
              req.user?.userId ||
              req.user?.clientId,
          },
          "Failed to send message"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};