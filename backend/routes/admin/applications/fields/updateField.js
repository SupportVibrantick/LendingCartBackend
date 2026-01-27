module.exports = async function updateField(fastify) {
  fastify.patch("/fields/:fieldId", async (req, reply) => {
    const updated = await fastify.prisma.brokerApplicationProductField.update({
      where: { id: req.params.fieldId },
      data: req.body,
    });

    reply.send({ success: true, data: updated });
  });
};
