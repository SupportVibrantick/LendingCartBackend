/**
 * Update Application Template (Admin)
 * Replaces products & fields atomically
 */
module.exports = async function updateTemplate(fastify) {
  fastify.put("/:templateId", async (req, reply) => {
    const { templateId } = req.params;
    const { name, description, isActive, products } = req.body;

    if (!templateId) {
      return reply.code(400).send({
        success: false,
        message: "templateId is required",
      });
    }

    if (!Array.isArray(products)) {
      return reply.code(400).send({
        success: false,
        message: "products must be an array",
      });
    }

    try {
      const result = await fastify.prisma.$transaction(async (tx) => {
        //  Ensure template exists
        const template = await tx.applicationTemplate.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          throw new Error("Template not found");
        }

        // Update template meta
        await tx.applicationTemplate.update({
          where: { id: templateId },
          data: {
            name,
            description,
            isActive,
          },
        });

        // Delete existing fields → products
        const existingProducts =
          await tx.applicationTemplateProduct.findMany({
            where: { applicationTemplateId: templateId },
            select: { id: true },
          });

        const productIds = existingProducts.map((p) => p.id);

        if (productIds.length) {
          await tx.applicationTemplateProductField.deleteMany({
            where: { applicationTemplateProductId: { in: productIds } },
          });

          await tx.applicationTemplateProduct.deleteMany({
            where: { id: { in: productIds } },
          });
        }

        // Recreate products + fields
        for (const product of products) {
          const createdProduct =
            await tx.applicationTemplateProduct.create({
              data: {
                applicationTemplateId: templateId,
                loanProductCode: product.loanProductCode,
                isActive: product.isActive ?? true,
              },
            });

          if (Array.isArray(product.fields) && product.fields.length) {
            await tx.applicationTemplateProductField.createMany({
              data: product.fields.map((field) => ({
                applicationTemplateProductId: createdProduct.id,
                fieldKey: field.fieldKey,
                label: field.label,
                placeholder: field.placeholder,
                fieldType: field.fieldType,
                isRequired: field.isRequired ?? false,
                options: field.options,
                validation: field.validation,
                sortOrder: field.sortOrder,
              })),
            });
          }
        }

        return { id: templateId };
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to update template",
      });
    }
  });
};
