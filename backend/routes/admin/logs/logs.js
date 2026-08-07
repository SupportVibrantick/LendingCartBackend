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
            category: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },

            actorUserId: { type: "string" },
            actorOrgId: { type: "string" },

            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },

            search: { type: "string" },
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
        category,
        entityType,
        entityId,
        actorUserId,
        actorOrgId,
        startDate,
        endDate,
        search,
      } = req.query;

      const pageNum = Math.max(Number(page) || 1, 1);
      const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 200);
      const skip = (pageNum - 1) * limitNum;
      const searchTerm = String(search || "").trim();
      const categoryTerm = String(category || "").trim();
      const entityTypeTerm = String(entityType || "").trim();

      const where = {};

      if (action) where.action = action;
      if (categoryTerm) where.category = categoryTerm;
      if (entityTypeTerm) where.entityType = entityTypeTerm;
      if (entityId) where.entityId = entityId;
      if (actorUserId) where.actorUserId = actorUserId;
      if (actorOrgId) where.actorOrgId = actorOrgId;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (searchTerm) {
        where.OR = [
          { entityId: { contains: searchTerm, mode: "insensitive" } },
          { action: { contains: searchTerm, mode: "insensitive" } },
          { entityType: { contains: searchTerm, mode: "insensitive" } },
          {
            actorUser: {
              email: { contains: searchTerm, mode: "insensitive" },
            },
          },
          {
            actorUser: {
              firstName: { contains: searchTerm, mode: "insensitive" },
            },
          },
          {
            actorUser: {
              lastName: { contains: searchTerm, mode: "insensitive" },
            },
          },
          {
            actorOrg: {
              name: { contains: searchTerm, mode: "insensitive" },
            },
          },
        ];
      }

      try {
        const [rows, total, categoryGroups, entityGroups] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limitNum,
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
          prisma.auditLog.groupBy({
            by: ["category"],
            _count: { _all: true },
            orderBy: { category: "asc" },
          }),
          prisma.auditLog.groupBy({
            by: ["entityType"],
            _count: { _all: true },
            orderBy: { entityType: "asc" },
          }),
        ]);

        return reply.send({
          success: true,
          total,
          page: pageNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
          limit: limitNum,
          data: rows,
          filters: {
            categories: categoryGroups.map((row) => row.category).filter(Boolean),
            entityTypes: entityGroups
              .map((row) => row.entityType)
              .filter(Boolean),
          },
        });
      } catch (err) {
        fastify.log.error("Failed to fetch audit logs", err);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch audit logs",
        });
      }
    },
  );
}

module.exports = logsRoutes;
