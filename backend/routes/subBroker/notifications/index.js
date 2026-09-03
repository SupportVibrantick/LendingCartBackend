/**
 * Co-broker in-app notifications (scoped to the logged-in user).
 */

async function coBrokerNotificationRoutes(fastify) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(["SUB_BROKER"]));

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Sub Broker -> Notifications"],
        summary: "List co-broker notifications",
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
      const userId = req.user?.id || req.user?.userId;

      try {
        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const skip = (page - 1) * limit;

        const whereClause = {
          deletedAt: null,
          recipientUserId: userId,
        };

        const [notifications, unreadCount, total] = await Promise.all([
          prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.notification.count({
            where: { ...whereClause, isRead: false },
          }),
          prisma.notification.count({ where: whereClause }),
        ]);

        return reply.send({
          success: true,
          data: {
            unreadCount,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit) || 1,
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

  fastify.patch(
    "/:id/read",
    {
      schema: {
        tags: ["Sub Broker -> Notifications"],
        summary: "Mark a co-broker notification as read",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const userId = req.user?.id || req.user?.userId;
      const { id } = req.params;

      try {
        const notification = await prisma.notification.findFirst({
          where: {
            id,
            recipientUserId: userId,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!notification) {
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
    },
  );

  fastify.patch(
    "/read-all",
    {
      schema: {
        tags: ["Sub Broker -> Notifications"],
        summary: "Mark all co-broker notifications as read",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const userId = req.user?.id || req.user?.userId;

      try {
        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        await prisma.notification.updateMany({
          where: {
            recipientUserId: userId,
            deletedAt: null,
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
    },
  );
}

module.exports = coBrokerNotificationRoutes;
