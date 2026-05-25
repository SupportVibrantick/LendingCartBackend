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
      const normalize = (str) => str?.trim().toLowerCase();

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

      if (!userId && !req.user?.email) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= VERIFY CONVERSATION ================= */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            loanApplicationId: true,
            applicationLenderId: true,
          },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* ================= CHECK PARTICIPATION ================= */

        const userEmail = req.user?.email;

        const participant =
          await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,

              OR: [
                { participantId: userId },

                userEmail
                  ? {
                      participantEmail: normalize(userEmail),
                    }
                  : undefined,
              ].filter(Boolean),
            },
          });

        let hasFallbackAccess = false;

        if (
          !participant &&
          req.user?.orgType === "LENDER" &&
          req.user?.organizationId &&
          conversation.applicationLenderId
        ) {
          const lenderAccess = await prisma.applicationLender.findFirst({
            where: {
              id: conversation.applicationLenderId,
              lenderOrgId: req.user.organizationId,
            },
            select: { id: true },
          });

          hasFallbackAccess = Boolean(lenderAccess);
        }

        if (
          !participant &&
          !hasFallbackAccess &&
          req.user?.orgType === "BROKER" &&
          req.user?.organizationId &&
          conversation.loanApplicationId
        ) {
          const brokerAccess = await prisma.loanApplication.findFirst({
            where: {
              id: conversation.loanApplicationId,
              brokerOrgId: req.user.organizationId,
            },
            select: { id: true },
          });

          hasFallbackAccess = Boolean(brokerAccess);
        }

        if (!participant && !hasFallbackAccess) {
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

  conversationId: msg.conversationId,

  type: msg.type,

  text: msg.text,

  fileUrl: msg.fileUrl,

  fileName: msg.fileName,

  fileSize: msg.fileSize,

  mimeType: msg.mimeType,

  senderType: msg.senderType,

  senderUserId: msg.senderUserId,

  senderClientUserId:
    msg.senderClientUserId,

  senderName: msg.senderName,

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
