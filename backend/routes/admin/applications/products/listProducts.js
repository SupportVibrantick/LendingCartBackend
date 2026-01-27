module.exports = async function listProducts(fastify) {
  fastify.get("/:applicationId/products", async (req, reply) => {
    const { applicationId } = req.params;
    const { brokerOrgId } = req.query;

    // Validation
    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    // Ensure application belongs to this broker
    const application = await fastify.prisma.brokerApplication.findFirst({
      where: {
        id: applicationId,
        brokerOrgId,
      },
      select: { id: true },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Application not found for this broker",
      });
    }

    const products = await fastify.prisma.brokerApplicationProduct.findMany({
      where: { brokerApplicationId: applicationId },
    });

    reply.send({ success: true, data: products });
  });
};
