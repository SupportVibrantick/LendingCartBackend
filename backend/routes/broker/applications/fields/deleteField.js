module.exports = async function deleteField(fastify) {
  fastify.delete("/fields/:fieldId", async (req, reply) => {
    await fastify.prisma.brokerApplicationProductField.delete({
      where: { id: req.params.fieldId },
    });

    reply.send({ success: true });
  });
};
