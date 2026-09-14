/**
 * List application templates (Admin) — slim payload for marketplace cards.
 * Use GET /:templateId for full products + fields (preview/edit).
 */
module.exports = async function listTemplates(fastify) {
  fastify.get("/", async (req, reply) => {
    try {
      const { parsePagination } = require("../../../../utils/pagination");
      const { skip, take, page, limit } = parsePagination(req.query, 50, 100);

      const [templates, total] = await Promise.all([
        fastify.prisma.applicationTemplate.findMany({
          skip,
          take,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            version: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            products: {
              select: {
                id: true,
                loanProductCode: true,
                isActive: true,
                _count: {
                  select: { fields: true },
                },
              },
              orderBy: { id: "asc" },
            },
          },
        }),
        fastify.prisma.applicationTemplate.count(),
      ]);

      return reply.send({
        success: true,
        total,
        page,
        limit,
        data: templates,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to load templates",
      });
    }
  });
};
