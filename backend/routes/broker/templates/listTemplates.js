module.exports = async function listTemplates(fastify) {
  fastify.get("/", async (req, reply) => {
    try {
      const templates = await fastify.prisma.applicationTemplate.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          products: {
            where: { isActive: true },
            include: {
              fields: {
                orderBy: { sortOrder: "asc" },
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
      // 🔥 LOG THE REAL ERROR
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to load templates",
      });
    }
  });
};
