module.exports = async function addField(fastify) {
  fastify.post("/products/:productId/fields", async (req, reply) => {
    const { productId } = req.params;
    const { fieldKey, label, fieldType, isRequired, options, validation } = req.body;

    const field = await fastify.prisma.brokerApplicationProductField.create({
      data: {
        applicationProductId: productId,
        fieldKey,
        label,
        fieldType,
        isRequired: !!isRequired,
        options,
        validation,
      },
    });

    reply.send({ success: true, data: field });
  });
};
