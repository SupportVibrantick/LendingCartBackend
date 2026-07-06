const { listEmailOutbox } = require("../../../services/email");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listEmailOutboxRoute(fastify) {
  fastify.get(
    "/outbox",
    {
      schema: {
        tags: ["Admin -> Email"],
        summary: "List email outbox delivery records",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["PENDING", "PROCESSING", "SENT", "FAILED", "DEAD"],
            },
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 50);
        const offset = (page - 1) * limit;
        const { status } = req.query;

        const prisma = fastify.prisma;
        const where = status ? { status } : undefined;

        const [records, total] = await Promise.all([
          listEmailOutbox(prisma, { status, limit, offset }),
          prisma.emailOutbox.count({ where }),
        ]);

        return reply.send({
          success: true,
          data: {
            records,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit) || 1,
            },
          },
        });
      } catch (error) {
        fastify.log.error(error, "Failed to list email outbox");
        return reply.code(500).send({
          success: false,
          message: "Failed to list email outbox",
        });
      }
    },
  );
}

module.exports = listEmailOutboxRoute;
