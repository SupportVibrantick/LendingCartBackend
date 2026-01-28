/**
 * Create Broker Application from Template
 */
module.exports = async function createFromTemplate(fastify) {
  fastify.post("/from-template", async (req, reply) => {
    const { templateId, name } = req.body;
    const brokerOrgId = req.user.organizationId;

    if (!templateId) {
      return reply.code(400).send({
        success: false,
        message: "templateId is required",
      });
    }

    try {
      const result = await fastify.prisma.$transaction(async (tx) => {
        // 1️⃣ Fetch active template
        const template = await tx.applicationTemplate.findFirst({
          where: {
            id: templateId,
            isActive: true,
          },
          include: {
            products: {
              where: { isActive: true },
              include: {
                fields: true,
              },
            },
          },
        });

        if (!template) {
          throw new Error("Template not found or inactive");
        }

        // 2️⃣ Generate broker application code
        const baseCode = template.code;
        let code = baseCode;
        let counter = 1;

        while (
          await tx.brokerApplication.findFirst({
            where: { brokerOrgId, code },
          })
        ) {
          code = `${baseCode}-${counter++}`;
        }

        // 3️⃣ Create broker application
        const application = await tx.brokerApplication.create({
          data: {
            brokerOrgId,
            name: name || template.name,
            code,
            isActive: false,
          },
        });

        // 4️⃣ Copy products + fields
        for (const product of template.products) {
          const appProduct = await tx.brokerApplicationProduct.create({
            data: {
              brokerApplicationId: application.id,
              loanProductCode: product.loanProductCode,
              isActive: true,
            },
          });

          if (product.fields?.length) {
            await tx.brokerApplicationProductField.createMany({
              data: product.fields.map((field) => ({
                applicationProductId: appProduct.id,
                fieldKey: field.fieldKey,
                label: field.label,
                placeholder: field.placeholder,
                fieldType: field.fieldType,
                isRequired: field.isRequired,
                options: field.options,
                validation: field.validation,
                sortOrder: field.sortOrder,
              })),
            });
          }
        }

        return application;
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to create application from template",
      });
    }
  });
};
