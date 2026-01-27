module.exports = async function addProduct(fastify) {
  fastify.post("/:applicationId/products", async (req, reply) => {
    const { applicationId } = req.params;
    const { loanProductCodes, brokerOrgId } = req.body;

    // Validate input
    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    if (!Array.isArray(loanProductCodes) || loanProductCodes.length === 0) {
      return reply.code(400).send({
        success: false,
        message: "loanProductCodes must be a non-empty array",
      });
    }

    // Ensure application belongs to this broker
    const application = await fastify.prisma.brokerApplication.findFirst({
      where: {
        id: applicationId,
        brokerOrgId,
      },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Application not found for this broker",
      });
    }

    // Validate all products exist & are active
    const products = await fastify.prisma.loanProduct.findMany({
      where: {
        code: { in: loanProductCodes },
        isActive: true,
      },
    });

    if (products.length !== loanProductCodes.length) {
      return reply.code(400).send({
        success: false,
        message: "One or more loan products are invalid",
      });
    }

    // Prepare bulk insert
    const data = loanProductCodes.map((code) => ({
      brokerApplicationId: applicationId,
      loanProductCode: code,
    }));

    // Insert multiple products
    const result = await fastify.prisma.brokerApplicationProduct.createMany({
      data,
      skipDuplicates: true, // respects @@unique([brokerApplicationId, loanProductCode])
    });

    return reply.send({
      success: true,
      insertedCount: result.count,
    });
  });
};
