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
        /* =====================================================
           1️⃣ AUTH CHECK
        ===================================================== */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        /* =====================================================
           2️⃣ VERIFY CONVERSATION EXISTS
        ===================================================== */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            loanApplicationId: true,
          },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* =====================================================
           3️⃣ CHECK USER IS PARTICIPANT
        ===================================================== */

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId,
            participantId: req.user.id,
          },
        });

        if (!participant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* =====================================================
           4️⃣ PAGINATION CALC
        ===================================================== */

        const skip = (page - 1) * limit;

        /* =====================================================
           5️⃣ FETCH MESSAGES
        ===================================================== */

        const messages = await prisma.message.findMany({
          where: {
            conversationId,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        });

        const total = await prisma.message.count({
          where: { conversationId },
        });

        /* =====================================================
           6️⃣ FORMAT RESPONSE
        ===================================================== */

        const formatted = messages.map((msg) => ({
          id: msg.id,
          type: msg.type,
          text: msg.text,
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          senderType: msg.senderType,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        }));

        /* =====================================================
           7️⃣ RESPONSE
        ===================================================== */

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
            userId: req.user?.id,
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