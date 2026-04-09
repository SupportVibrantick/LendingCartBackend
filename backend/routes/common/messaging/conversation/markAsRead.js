/**
 * Mark conversation as read
 */

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

        // 🔥 FIX: normalize user
        const userId =
          req.user?.id || req.user?.userId || req.user?.clientId;

        const userEmail = req.user?.email;

        console.log("👤 MarkRead User:", { userId, userEmail });

        if (!userId && !userEmail) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= VERIFY PARTICIPANT ================= */

        const normalize = (str) => str?.trim().toLowerCase();

        const participant =
          await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,
              OR: [
                { participantId: userId },
                {
                  participantEmail: userEmail
                    ? normalize(userEmail)
                    : undefined,
                },
              ],
            },
          });

        if (!participant) {
          console.error("❌ MarkRead access denied:", {
            conversationId,
            userId,
            userEmail,
          });

          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ================= UPDATE lastReadAt ================= */

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