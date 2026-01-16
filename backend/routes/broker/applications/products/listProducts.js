module.exports = async function listProducts(fastify) {
  fastify.get("/:applicationId/products", async (req, reply) => {
    const products = await fastify.prisma.brokerApplicationProduct.findMany({
      where: { brokerApplicationId: req.params.applicationId },
    });

    reply.send({ success: true, data: products });
  });
};
