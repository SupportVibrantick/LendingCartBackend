/**
 * List all application templates (Admin)
 * Includes products and fields
 */
module.exports = async function listTemplates(fastify) {
  fastify.get("/", async (_req, reply) => {
    try {
      const templates = await fastify.prisma.applicationTemplate.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          products: {
            orderBy: {
              id: "asc", // use id or sortOrder if you add it later
            },
            include: {
              fields: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
      });

      return reply.send({
        success: true,
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
