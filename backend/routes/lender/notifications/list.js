async function listLenderNotifications(fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      /* ================= AUTH ================= */

      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only"
        });
      }

      const orgId = req.user.organizationId;
      const userId = req.user.id;

      /* ================= PAGINATION ================= */

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const skip = (page - 1) * limit;

      /* ================= FILTER ================= */

      const whereClause = {
        deletedAt: null,
        recipientType: "LENDER",
        OR: [
          { recipientOrgId: orgId },
          { recipientUserId: userId }
        ]
      };

      /* ================= DATA ================= */

      const [notifications, unreadCount, total] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit
        }),

        prisma.notification.count({
          where: { ...whereClause, isRead: false }
        }),

        prisma.notification.count({
          where: whereClause
        })
      ]);

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
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to fetch notifications"
      });
    }
  });
}

module.exports = listLenderNotifications;