module.exports = async function addTemplateField(fastify) {
  fastify.post("/", async (req, reply) => {
    const { productId } = req.params;
    const { fieldKey, label, fieldType } = req.body;

    if (!fieldKey || !label || !fieldType) {
      return reply.code(400).send({
        success: false,
        message: "fieldKey, label and fieldType are required",
      });
    }

    const field = await fastify.prisma.applicationTemplateProductField.create({
      data: {
        applicationTemplateProductId: productId,
        ...req.body,
      },
    });

    reply.send({ success: true, data: field });
  });
};
