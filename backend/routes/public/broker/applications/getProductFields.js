module.exports = async function getProductFields(fastify) {
  fastify.get(
    "/:applicationId/products/:loanProductCode/fields",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
      const { applicationId, loanProductCode } = req.params;

      const product = await fastify.prisma.brokerApplicationProduct.findFirst({
        where: {
          brokerApplicationId: applicationId,
          loanProductCode,
        },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          message: "Product not configured",
        });
      }

      reply.send({
        success: true,
        fields: product.fields,
      });
    }
  );
};
