/**
 * Mark conversation as read
 */

const {
  assertCanAccessConversation,
  getUserId,
} = require("../../../../services/messaging/messagingAccess");

module.exports = async function markAsRead(fastify) {
  fastify.patch(
    "/conversation/:conversationId/read",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Mark conversation as read",
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
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = getUserId(req.user);
        const userEmail = req.user?.email;

        if (!userId && !userEmail) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        const access = await assertCanAccessConversation(
          prisma,
          req.user,
          conversationId,
        );

        if (!access.allowed) {
          return reply.code(access.error?.code || 403).send({
            success: false,
            message: access.error?.message || "Access denied",
          });
        }

        const normalize = (str) => str?.trim().toLowerCase();

        let participant =
          access.participant ||
          (await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,
              OR: [
                userId ? { participantId: userId } : undefined,
                userEmail
                  ? { participantEmail: normalize(userEmail) }
                  : undefined,
              ].filter(Boolean),
            },
          }));

        if (!participant && userId) {
          participant = await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,
              participantId: userId,
            },
          });
        }

        if (!participant) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        await prisma.conversationParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            lastReadAt: new Date(),
          },
        });

        console.log("✅ Marked as read:", {
          conversationId,
          participantId: participant.id,
        });

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          message: "Conversation marked as read",
        });

      } catch (error) {
        console.error("💥 MARK READ ERROR:", error.message);

        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId:
              req.user?.id ||
              req.user?.userId ||
              req.user?.clientId,
          },
          "Failed to mark conversation as read"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};