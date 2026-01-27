module.exports = async function removeProduct(fastify) {
  fastify.delete("/:applicationId/products/:loanProductCode", async (req, reply) => {
    const { applicationId, loanProductCode } = req.params;
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

    await fastify.prisma.brokerApplicationProduct.deleteMany({
      where: {
        brokerApplicationId: applicationId,
        loanProductCode,
      },
    });

    reply.send({ success: true });
  });
};
