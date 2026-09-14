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
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          version: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
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
