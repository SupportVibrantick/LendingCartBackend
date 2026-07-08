const { buildPlatformNotificationFilter } = require("../../../services/notifications/platformNotifications");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listAdminNotifications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Notifications"],
        summary: "Fetch platform admin notifications",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const skip = (page - 1) * limit;

        const whereClause = buildPlatformNotificationFilter(req.user);

        const notifications = await prisma.notification.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });

        const unreadCount = await prisma.notification.count({
          where: { ...whereClause, isRead: false },
        });

        const total = await prisma.notification.count({
          where: whereClause,
        });

        return reply.send({
          success: true,
          data: {
            unreadCount,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
            notifications,
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch notifications",
        });
      }
    },
  );
}

module.exports = listAdminNotifications;
