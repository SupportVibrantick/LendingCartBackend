/**
 * Get a single application template with products + fields (Admin preview/edit).
 */
module.exports = async function getTemplateDetails(fastify) {
  fastify.get("/:templateId", async (req, reply) => {
    try {
      const { templateId } = req.params;

      // Avoid clashing with other static routes under /templates
      if (
        !templateId ||
        templateId === "status" ||
        !/^[0-9a-f-]{36}$/i.test(templateId)
      ) {
        return reply.code(404).send({
          success: false,
          message: "Template not found",
        });
      }

      const template = await fastify.prisma.applicationTemplate.findUnique({
        where: { id: templateId },
        include: {
          products: {
            orderBy: { id: "asc" },
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
          message: "Template not found",
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
        message: "Failed to load template",
      });
    }
  });
};
