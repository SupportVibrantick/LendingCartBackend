/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function activeApplication(fastify) {
  fastify.get("/active", async (req, reply) => {
    // broker guard
    if (!req.user || req.user.orgType !== "BROKER") {
      return reply.code(403).send({
        success: false,
        message: "Broker access only",
      });
    }

    const brokerOrgId = req.user.organizationId;

    if (!brokerOrgId) {
      return reply.code(403).send({
        success: false,
        message: "Broker context not resolved",
      });
    }

    const application = await fastify.prisma.brokerApplication.findFirst({
      where: {
        brokerOrgId,
        isActive: true,
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
        products: application.products.map((product) => {
          const sectionedSections = product.sections.map((section) => ({
            id: section.id,
            name: section.name,
            description: section.description,
            sortOrder: section.sortOrder,
            fields: product.fields
              .filter((field) => field.sectionId === section.id)
              .map((field) => ({
                id: field.id,
                fieldKey: field.fieldKey,
                label: field.label,
                fieldType: field.fieldType,
                placeholder: field.placeholder,
                isRequired: field.isRequired,
                options: field.options,
                validation: field.validation,
                sortOrder: field.sortOrder,
              })),
          }));

          const unsectionedFields = product.fields
            .filter((field) => field.sectionId === null)
            .map((field) => ({
              id: field.id,
              fieldKey: field.fieldKey,
              label: field.label,
              fieldType: field.fieldType,
              placeholder: field.placeholder,
              isRequired: field.isRequired,
              options: field.options,
              validation: field.validation,
              sortOrder: field.sortOrder,
            }));

          return {
            productId: product.id,
            loanProductCode: product.loanProductCode,
            sections: sectionedSections,
            unsectionedFields,
          };
        }),
      },
    });
  });
};
