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
        /* =====================================================
           1️⃣ AUTH CHECK
        ===================================================== */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ FIX: handle both id formats safely
        const userId = req.user?.id || req.user?.userId;

        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* =====================================================
           2️⃣ VALIDATE MESSAGE CONTENT
        ===================================================== */

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

        /* =====================================================
           3️⃣ VERIFY CONVERSATION
        ===================================================== */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* =====================================================
           4️⃣ CHECK PARTICIPATION
        ===================================================== */

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId,
            participantId: userId, // ✅ FIXED
          },
        });

        if (!participant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* =====================================================
           5️⃣ CREATE MESSAGE
        ===================================================== */

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderType: req.user.orgType,
            senderId: userId, // ✅ FIXED
            type,
            text: type === "TEXT" ? text : null,
            fileUrl: type === "FILE" ? fileUrl : null,
            fileName: type === "FILE" ? fileName : null,
            fileSize: type === "FILE" ? fileSize : null,
            mimeType: type === "FILE" ? mimeType : null,
            metadata: metadata || null,
          },
        });

        /* =====================================================
           6️⃣ UPDATE CONVERSATION LAST MESSAGE
        ===================================================== */

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
          },
        });

        /* =====================================================
           7️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          data: {
            id: message.id,
            type: message.type,
            text: message.text,
            fileUrl: message.fileUrl,
            senderType: message.senderType,
            senderId: message.senderId,
            createdAt: message.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.id || req.user?.userId,
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