/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function activeApplication(fastify) {
  fastify.get("/active", async (req, reply) => {
    const { brokerOrgId } = req.query;

    // Validation
    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
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
          fields: product.fields.map((field) => ({
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
      },
    });
  });
};
