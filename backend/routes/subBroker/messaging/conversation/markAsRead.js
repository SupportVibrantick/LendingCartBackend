/**
 * Mark sub-broker conversation as read
 */

module.exports = async function markAsRead(fastify) {
  fastify.patch(
    "/conversation/:conversationId/read",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Mark sub-broker conversation as read",
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
      const userId = req.user?.userId;

      try {
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId,
            participantId: userId,
            participantType: "SUB_BROKER",
          },
        });

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

        return reply.send({
          success: true,
          message: "Conversation marked as read",
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId,
          },
          "Failed to mark sub-broker conversation as read"
        );

        return reply.code(500).send({
          success: false,
         message: error.message,
        });
      }
    }
  );
};
