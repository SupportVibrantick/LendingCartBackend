const { buildPlatformNotificationFilter } = require("../../../services/notifications/platformNotifications");

async function deleteAdminNotification(fastify) {
  fastify.delete("/:id", async (req, reply) => {
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
          deletedAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "Notification deleted",
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to delete notification",
      });
    }
  });
}

module.exports = deleteAdminNotification;
