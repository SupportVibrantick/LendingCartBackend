const { buildPlatformNotificationFilter } = require("../../../services/notifications/platformNotifications");

async function markAdminNotificationRead(fastify) {
  fastify.patch("/:id/read", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const { id } = req.params;
      const whereClause = buildPlatformNotificationFilter(req.user);

      const existing = await prisma.notification.findFirst({
        where: { id, ...whereClause },
      });

      if (!existing) {
        return reply.code(404).send({
          success: false,
          message: "Notification not found",
        });
      }

      await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notification",
      });
    }
  });
}

module.exports = markAdminNotificationRead;
