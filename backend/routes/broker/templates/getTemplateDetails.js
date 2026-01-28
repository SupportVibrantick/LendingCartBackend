/**
 * Get single application template details (Broker)
 */
module.exports = async function getTemplateDetails(fastify) {
  fastify.get("/:templateId", async (req, reply) => {
    try {
      const { templateId } = req.params;

      const template = await fastify.prisma.applicationTemplate.findFirst({
        where: {
          id: templateId,
          isActive: true,
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

      if (!template) {
        return reply.code(404).send({
          success: false,
          message: "Template not found or inactive",
        });
      }

      return reply.send({
        success: true,
        data: template,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to load template details",
      });
    }
  });
};
