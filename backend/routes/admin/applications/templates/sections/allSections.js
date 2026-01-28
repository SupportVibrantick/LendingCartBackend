/**
 * List all sections for a template product
 */
module.exports = async function allTemplateSections(fastify) {
  fastify.get("/", async (req, reply) => {
    const { productId } = req.params;

    if (!productId) {
      return reply.code(400).send({
        success: false,
        message: "productId is required",
      });
    }

    const sections =
      await fastify.prisma.applicationTemplateSection.findMany({
        where: {
          applicationTemplateProductId: productId,
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          fields: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

    reply.send({
      success: true,
      data: sections,
    });
  });
};
