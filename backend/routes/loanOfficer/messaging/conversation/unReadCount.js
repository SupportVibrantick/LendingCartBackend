/**
 * Get unread message count (all conversations)
 */

const { extraOfficerPermission, LOAN_OFFICER_MESSAGING_PERMISSIONS } = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function getUnreadCount(fastify) {
  fastify.get(
    "/unread-count",
    {
      preHandler: extraOfficerPermission(fastify, LOAN_OFFICER_MESSAGING_PERMISSIONS),
      schema: {
        tags: ["Messaging"],
        summary: "Get unread message count",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // 🔥 normalize user
        const userId =
          req.user?.id || req.user?.userId || req.user?.clientId;

        const userEmail = req.user?.email;

        console.log("👤 UnreadCount User:", { userId, userEmail });

        if (!userId && !userEmail) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= GET PARTICIPATIONS ================= */

        const normalize = (str) => str?.trim().toLowerCase();

        const participations =
          await prisma.conversationParticipant.findMany({
            where: {
              OR: [
                { participantId: userId },
                userEmail
                  ? {
                      participantEmail: normalize(userEmail),
                    }
                  : undefined,
              ].filter(Boolean),
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

        /* ================= COUNT UNREAD ================= */

        let totalUnread = 0;
        const perConversation = [];

        for (const p of participations) {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: p.conversationId,

              // only messages after last read
              ...(p.lastReadAt && {
                createdAt: {
                  gt: p.lastReadAt,
                },
              }),

              // exclude own messages
              NOT: {
                OR: [
                  { senderUserId: userId },
                  { senderClientUserId: userId },
                ],
              },
            },
          });

          if (unreadCount > 0) {
            perConversation.push({
              conversationId: p.conversationId,
              unreadCount,
            });
          }

          totalUnread += unreadCount;
        }

        /* ================= RESPONSE ================= */

        console.log("📊 Unread Count:", totalUnread);

        return reply.send({
          success: true,
          data: {
            totalUnread,
            conversations: perConversation,
          },
        });

      } catch (error) {
        console.error("💥 UNREAD COUNT ERROR:", error.message);

        fastify.log.error(
          {
            error: error.message,
            userId:
              req.user?.id ||
              req.user?.userId ||
              req.user?.clientId,
          },
          "Failed to fetch unread count"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};