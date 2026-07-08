const { buildPlatformNotificationFilter } = require("../../../services/notifications/platformNotifications");

async function markAllAdminNotificationsRead(fastify) {
  fastify.patch("/read-all", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const whereClause = buildPlatformNotificationFilter(req.user);

      await prisma.notification.updateMany({
        where: {
          ...whereClause,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notifications",
      });
    }
  });
}

module.exports = markAllAdminNotificationsRead;
