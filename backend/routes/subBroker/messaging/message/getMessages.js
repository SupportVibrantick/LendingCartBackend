/**
 * Get messages of a sub-broker conversation
 */

module.exports = async function getMessages(fastify) {
  fastify.get(
    "/conversation/:conversationId/messages",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Get messages of a sub-broker conversation",
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

        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
          prisma.message.findMany({
            where: {
              conversationId,
            },
            orderBy: {
              createdAt: "desc",
            },
            skip,
            take: limit,
          }),
          prisma.message.count({
            where: {
              conversationId,
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: {
            conversationId,
            page,
            limit,
            total,
            messages: messages.reverse().map((message) => ({
              id: message.id,
              type: message.type,
              text: message.text,
              fileUrl: message.fileUrl,
              fileName: message.fileName,
              fileSize: message.fileSize,
              mimeType: message.mimeType,
              metadata: message.metadata,
              senderType: message.senderType,
              senderUserId: message.senderUserId,
              senderClientUserId: message.senderClientUserId,
              senderName: message.senderName,
              createdAt: message.createdAt,
            })),
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId,
          },
          "Failed to fetch sub-broker messages",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
