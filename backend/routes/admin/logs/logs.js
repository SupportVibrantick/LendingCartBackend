// routes/admin/logs.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function logsRoutes(fastify) {
  // GET /admin/logs
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Logs"],
        summary: "List audit logs (DB-based)",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            action: { type: "string" },
            entityType: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { page = 1, limit = 20, action, entityType } = req.query;

      const skip = (page - 1) * limit;

      const where = {};
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;

      try {
        const [rows, total] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              actorUser: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
              actorOrg: {
                select: { id: true, name: true },
              },
            },
          }),
          prisma.auditLog.count({ where }),
        ]);

        return reply.send({
          success: true,
          total,
          page,
          limit,
          data: rows,
        });
      } catch (err) {
        fastify.log.error("Failed to fetch audit logs", err);
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );

  // GET /admin/logs/:id
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Logs"],
        summary: "Get a single audit log entry",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const log = await prisma.auditLog.findUnique({
          where: { id },
          include: {
            actorUser: true,
            actorOrg: true,
          },
        });

        if (!log) {
          return reply.status(404).send({ success: false, message: "Log not found" });
        }

        return reply.send({ success: true, data: log });
      } catch (err) {
        fastify.log.error("Failed to read audit log", err);
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );
}

module.exports = logsRoutes;
