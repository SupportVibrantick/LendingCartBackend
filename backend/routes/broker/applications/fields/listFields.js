module.exports = async function listFields(fastify) {
  fastify.get("/products/:productId/fields", async (req, reply) => {
    /* ===============================
       1. BROKER GUARD
    =============================== */
    if (!req.user || req.user.orgType !== "BROKER") {
      return reply.code(403).send({
        success: false,
        message: "Broker access only",
      });
    }

    const { productId } = req.params;
    const brokerOrgId = req.user.organizationId;

    /* ===============================
       2. VERIFY PRODUCT OWNERSHIP
    =============================== */
    const product =
      await fastify.prisma.brokerApplicationProduct.findFirst({
        where: {
          id: productId,
          brokerApplication: {
            brokerOrgId,
          },
        },
        select: {
          id: true,
          brokerApplicationId: true, // ✅ applicationId
        },
      });

    if (!product) {
      return reply.code(404).send({
        success: false,
        message: "Application product not found",
      });
    }

    /* ===============================
       3. FETCH SECTIONS + FIELDS
    =============================== */
    const sections =
      await fastify.prisma.brokerApplicationSection.findMany({
        where: {
          applicationProductId: productId,
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

    /* ===============================
       4. FETCH UNSECTIONED FIELDS
    =============================== */
    const unsectionedFields =
      await fastify.prisma.brokerApplicationProductField.findMany({
        where: {
          applicationProductId: productId,
          sectionId: null,
        },
        orderBy: {
          sortOrder: "asc",
        },
      });

    /* ===============================
       5. RESPONSE (FINAL SHAPE)
    =============================== */
    return reply.send({
      success: true,
      data: {
        applicationId: product.brokerApplicationId, //  added
        productId: product.id,
        sections: sections.map(section => ({
          id: section.id,
          name: section.name,
          description: section.description,
          sortOrder: section.sortOrder,
          fields: section.fields.map(field => ({
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
        })),
        unsectionedFields: unsectionedFields.map(field => ({
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
      },
    });
  });
};
