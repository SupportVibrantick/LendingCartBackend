module.exports = async function removeProduct(fastify) {
  fastify.delete("/:applicationId/products/:loanProductCode", async (req, reply) => {
    const { applicationId, loanProductCode } = req.params;

    await fastify.prisma.brokerApplicationProduct.deleteMany({
      where: { brokerApplicationId: applicationId, loanProductCode },
    });

    reply.send({ success: true });
  });
};
