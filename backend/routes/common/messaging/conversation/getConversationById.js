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
        /* ================= AUTH CHECK ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ SINGLE SOURCE OF TRUTH (FIXED)
        const userId = req.user?.id || req.user?.userId;

        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= FETCH CONVERSATION ================= */

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

        /* ================= PARTICIPANT VALIDATION ================= */

        const isParticipant = conversation.participants.some(
          (p) => p.participantId === userId
        );

        if (!isParticipant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ================= BUILD TITLE ================= */

        let title = "Conversation";

        try {
          // CLIENT CHAT
          if (conversation.type === "CLIENT_BROKER") {
            const loan = await prisma.loanApplication.findUnique({
              where: { id: conversation.loanApplicationId },
              select: {
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
              select: {
                lender: {
                  select: { name: true },
                },
              },
            });

            title = `Lender - ${
              appLender?.lender?.name || "Unknown"
            }`;
          }
        } catch (err) {
          // non-blocking (title failure should not break API)
          fastify.log.error(
            { error: err.message, conversationId },
            "Title generation failed"
          );
        }

        /* ================= RESPONSE ================= */

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
            stack: error.stack,
            conversationId,
            userId: req.user?.id || req.user?.userId,
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