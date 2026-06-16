const { getClientFromRequest } = require("../../../utils/clientPortalAuth");

async function listClientNotifications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Fetch client notifications",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const auth = getClientFromRequest(req);
        if (auth.error) {
          return reply.code(auth.error.code).send({
            success: false,
            message: auth.error.message,
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const skip = (page - 1) * limit;

        const whereClause = {
          deletedAt: null,
          recipientClientId: auth.clientId,
        };

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
        fastify.log.error({ error: error.message }, "Client notifications list failed");

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch notifications",
        });
      }
    },
  );
}

module.exports = listClientNotifications;
