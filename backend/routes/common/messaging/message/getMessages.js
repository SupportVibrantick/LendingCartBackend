/**
 * Get messages of a conversation
 */

module.exports = async function getMessages(fastify) {
  fastify.get(
    "/conversation/:conversationId/messages",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Get messages of a conversation",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      try {
        /* ================= AUTH CHECK ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ SAFE USER ID (ALL CASES COVERED)
        const userId =
          req.user?.id || req.user?.userId || req.user?.clientId;

        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= VERIFY CONVERSATION ================= */

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

        /* ================= CHECK PARTICIPATION ================= */

        const participant = await prisma.conversationParticipant.findFirst({
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

        /* ================= PAGINATION ================= */

        const skip = (page - 1) * limit;

        /* ================= FETCH MESSAGES ================= */

        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });

        const total = await prisma.message.count({
          where: { conversationId },
        });

        /* ================= FORMAT RESPONSE ================= */

        const formatted = messages.map((msg) => ({
          id: msg.id,
          type: msg.type,
          text: msg.text,
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          mimeType: msg.mimeType,
          senderType: msg.senderType,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        }));

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          data: {
            conversationId,
            page,
            limit,
            total,
            messages: formatted.reverse(), // oldest → newest
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId:
              req.user?.id ||
              req.user?.userId ||
              req.user?.clientId,
          },
          "Failed to fetch messages"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};