/**
 * Get single conversation details
 */

module.exports = async function getConversationById(fastify) {
  fastify.get(
    "/conversation/:conversationId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Get conversation details",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;

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
           2️⃣ FETCH CONVERSATION
        ===================================================== */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            participants: true,
          },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* =====================================================
           3️⃣ VERIFY USER IS PARTICIPANT
        ===================================================== */

        const isParticipant = conversation.participants.find(
          (p) => p.participantId === req.user.id
        );

        if (!isParticipant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* =====================================================
           4️⃣ BUILD RESPONSE DATA
        ===================================================== */

        let title = "Conversation";

        // CLIENT CHAT
        if (conversation.type === "CLIENT_BROKER") {
          const loan = await prisma.loanApplication.findUnique({
            where: { id: conversation.loanApplicationId },
            include: {
              client: {
                select: { legalName: true },
              },
            },
          });

          title = `Client - ${loan?.client?.legalName || "Unknown"}`;
        }

        // LENDER CHAT
        if (
          conversation.type === "BROKER_LENDER" &&
          conversation.applicationLenderId
        ) {
          const appLender = await prisma.applicationLender.findUnique({
            where: { id: conversation.applicationLenderId },
            include: {
              lender: {
                select: { name: true },
              },
            },
          });

          title = `Lender - ${
            appLender?.lender?.name || "Unknown"
          }`;
        }

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          data: {
            id: conversation.id,
            type: conversation.type,
            loanApplicationId: conversation.loanApplicationId,
            applicationLenderId: conversation.applicationLenderId,
            title,
            participants: conversation.participants,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.id,
          },
          "Failed to fetch conversation"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};