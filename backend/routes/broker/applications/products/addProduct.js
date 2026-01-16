module.exports = async function addProduct(fastify) {
  fastify.post("/:applicationId/products", async (req, reply) => {
    const { applicationId } = req.params;
    const { loanProductCode } = req.body;

    // Validate admin product
    const product = await fastify.prisma.loanProduct.findFirst({
      where: { code: loanProductCode, isActive: true },
    });

    if (!product) {
      return reply.code(400).send({
        success: false,
        message: "Invalid loan product",
      });
    }

    const record = await fastify.prisma.brokerApplicationProduct.create({
      data: {
        brokerApplicationId: applicationId,
        loanProductCode,
      },
    });

    reply.send({ success: true, data: record });
  });
};
