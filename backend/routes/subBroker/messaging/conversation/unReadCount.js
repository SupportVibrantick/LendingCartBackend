/**
 * Get sub-broker unread message count
 */

module.exports = async function getUnreadCount(fastify) {
  fastify.get(
    "/unread-count",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Get unread message count for sub-broker conversations",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const userId = req.user?.userId;

      try {
        const participations = await prisma.conversationParticipant.findMany({
          where: {
            participantId: userId,
            participantType: "SUB_BROKER",
            conversation: {
              type: "CLIENT_BROKER",
            },
          },
          select: {
            conversationId: true,
            lastReadAt: true,
          },
        });

        if (!participations.length) {
          return reply.send({
            success: true,
            data: {
              totalUnread: 0,
              conversations: [],
            },
          });
        }

        let totalUnread = 0;
        const conversations = [];

        for (const participation of participations) {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: participation.conversationId,
              ...(participation.lastReadAt
                ? {
                    createdAt: {
                      gt: participation.lastReadAt,
                    },
                  }
                : {}),
              NOT: {
                senderUserId: userId,
              },
            },
          });

          if (unreadCount > 0) {
            totalUnread += unreadCount;
            conversations.push({
              conversationId: participation.conversationId,
              unreadCount,
            });
          }
        }

        return reply.send({
          success: true,
          data: {
            totalUnread,
            conversations,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            userId,
          },
          "Failed to fetch sub-broker unread count"
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
};
