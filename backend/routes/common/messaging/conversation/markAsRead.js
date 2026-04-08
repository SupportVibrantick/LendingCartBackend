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
           2️⃣ VERIFY PARTICIPANT
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
           3️⃣ UPDATE lastReadAt
        ===================================================== */

        await prisma.conversationParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            lastReadAt: new Date(),
          },
        });

        /* =====================================================
           4️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          message: "Conversation marked as read",
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.id,
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