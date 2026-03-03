module.exports = async function updateProducts(fastify) {
  fastify.put("/:applicationId/products", async (req, reply) => {
    const { applicationId } = req.params;
    const { loanProductCodes, brokerOrgId } = req.body;

    // Validate brokerOrgId
    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    //  Validate loanProductCodes
    if (!Array.isArray(loanProductCodes)) {
      return reply.code(400).send({
        success: false,
        message: "loanProductCodes must be an array",
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

    // Validate all products exist & are active
    if (loanProductCodes.length > 0) {
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
    }

    // Transaction (delete + insert)
    await fastify.prisma.$transaction(async (prisma) => {
      // Delete existing
      await prisma.brokerApplicationProduct.deleteMany({
        where: { brokerApplicationId: applicationId },
      });

      // Insert new if provided
      if (loanProductCodes.length > 0) {
        const data = loanProductCodes.map((code) => ({
          brokerApplicationId: applicationId,
          loanProductCode: code,
        }));

        await prisma.brokerApplicationProduct.createMany({
          data,
          skipDuplicates: true,
        });
      }
    });

    return reply.send({
      success: true,
      message: "Application products updated successfully",
    });
  });
};