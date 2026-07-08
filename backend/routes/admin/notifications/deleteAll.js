const { buildPlatformNotificationFilter } = require("../../../services/notifications/platformNotifications");

async function deleteAllAdminNotifications(fastify) {
  fastify.delete(
    "/delete-all",
    {
      schema: {
        tags: ["Admin -> Notifications"],
        summary: "Delete all platform admin notifications",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const whereClause = buildPlatformNotificationFilter(req.user);

        const result = await prisma.notification.updateMany({
          where: whereClause,
          data: {
            deletedAt: new Date(),
          },
        });

        return reply.send({
          success: true,
          message: "All notifications deleted",
          deletedCount: result.count,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to delete notifications",
        });
      }
    },
  );
}

module.exports = deleteAllAdminNotifications;
