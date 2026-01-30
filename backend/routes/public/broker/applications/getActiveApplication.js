/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getPublicActiveApplication(fastify) {
  fastify.get("/active", async (req, reply) => {
    const application = await fastify.prisma.brokerApplication.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc", //ensures latest active application
      },
      include: {
        products: {
          where: { isActive: true },
          include: {
            sections: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                name: true,
                description: true,
                sortOrder: true,
              },
            },
            fields: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                fieldKey: true,
                label: true,
                fieldType: true,
                placeholder: true,
                isRequired: true,
                options: true,
                validation: true,
                sortOrder: true,
                sectionId: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "No active application found",
      });
    }

    return reply.send({
      success: true,
      data: {
        applicationId: application.id,
        applicationName: application.name,
        products: application.products.map((product) => ({
          productId: product.id,
          loanProductCode: product.loanProductCode,
          sections: product.sections.map((section) => ({
            sectionId: section.id,
            sectionName: section.name,
            description: section.description,
            sortOrder: section.sortOrder,
            fields: product.fields
              .filter((field) => field.sectionId === section.id)
              .map((field) => ({
                fieldId: field.id,
                fieldKey: field.fieldKey,
                label: field.label,
                type: field.fieldType,
                placeholder: field.placeholder,
                required: field.isRequired,
                options: field.options,
                validation: field.validation,
                sortOrder: field.sortOrder,
              })),
          })),
        })),
      },
    });
  });
};
