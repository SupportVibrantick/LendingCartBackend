module.exports = async function createFromTemplate(fastify) {
  fastify.post("/from-template", async (req, reply) => {
    const { templateId } = req.body;
    const brokerOrgId = req.user.organizationId;

    if (!templateId) {
      return reply.code(400).send({
        success: false,
        message: "templateId is required",
      });
    }

    const app = await fastify.prisma.$transaction(async (tx) => {
      const template = await tx.applicationTemplate.findUnique({
        where: { id: templateId },
        include: {
          products: { include: { fields: true } },
        },
      });

      if (!template || !template.isActive) {
        throw new Error("Invalid template");
      }

      const brokerApp = await tx.brokerApplication.create({
        data: {
          brokerOrgId,
          name: template.name,
          isActive: false,
          createdFromTemplate: true,
        },
      });


      for (const product of template.products) {
        const brokerProduct = await tx.brokerApplicationProduct.create({
          data: {
            brokerApplicationId: brokerApp.id,
            loanProductCode: product.loanProductCode,
          },
        });

        for (const field of product.fields) {
          await tx.brokerApplicationProductField.create({
            data: {
              applicationProductId: brokerProduct.id,
              fieldKey: field.fieldKey,
              label: field.label,
              placeholder: field.placeholder,
              fieldType: field.fieldType,
              isRequired: field.isRequired,
              options: field.options,
              validation: field.validation,
              sortOrder: field.sortOrder,
            },
          });
        }
      }

      return brokerApp;
    });

    reply.send({ success: true, data: app });
  });
};
