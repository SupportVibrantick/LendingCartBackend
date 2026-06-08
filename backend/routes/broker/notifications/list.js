/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function listBrokerNotifications(fastify) {

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Notifications"],
        summary: "Fetch broker notifications",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 }
          }
        }
      }
    },
    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        /* =========================
           AUTHORIZATION
        ========================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const orgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;

        if (!orgId && !userId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid user context"
          });
        }

        /* =========================
           PAGINATION
        ========================= */

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);

        const skip = (page - 1) * limit;

        /* =========================
           BUILD SAFE FILTER
        ========================= */

        const orConditions = [];

        if (orgId) {
          orConditions.push({ recipientOrgId: orgId });
        }

        if (userId) {
          orConditions.push({ recipientUserId: userId });
        }

        const whereClause = {
          deletedAt: null,
          OR: orConditions
        };

        /* =========================
           FETCH NOTIFICATIONS
        ========================= */

        const notifications = await prisma.notification.findMany({
          where: whereClause,
          orderBy: {
            createdAt: "desc"
          },
          skip,
          take: limit
        });

        /* =========================
           UNREAD COUNT
        ========================= */

        const unreadCount = await prisma.notification.count({
          where: {
            ...whereClause,
            isRead: false
          }
        });

        /* =========================
           TOTAL COUNT
        ========================= */

        const total = await prisma.notification.count({
          where: whereClause
        });

        /* =========================
           RESPONSE
        ========================= */

        return reply.send({
          success: true,
          data: {
            unreadCount,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            },
            notifications
          }
        });

      } catch (error) {

        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch notifications"
        });

      }

    }
  );
}

module.exports = listBrokerNotifications;