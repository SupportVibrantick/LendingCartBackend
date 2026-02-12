/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function logsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Audit Logs"],
        summary: "List audit logs with filters",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },

            action: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },

            actorUserId: { type: "string" },
            actorOrgId: { type: "string" },

            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },

            search: { type: "string" }
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      const {
        page = 1,
        limit = 20,
        action,
        entityType,
        entityId,
        actorUserId,
        actorOrgId,
        startDate,
        endDate,
        search,
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {};

      // Filters
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (actorUserId) where.actorUserId = actorUserId;
      if (actorOrgId) where.actorOrgId = actorOrgId;

      // Date filtering
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Text search (entityId or action)
      if (search) {
        where.OR = [
          { entityId: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
          { entityType: { contains: search, mode: "insensitive" } },
        ];
      }

      try {
        const [rows, total] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              actorUser: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              actorOrg: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          }),
          prisma.auditLog.count({ where }),
        ]);

        return reply.send({
          success: true,
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit,
          data: rows,
        });
      } catch (err) {
        fastify.log.error("Failed to fetch audit logs", err);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch audit logs",
        });
      }
    }
  );
}

module.exports = logsRoutes;