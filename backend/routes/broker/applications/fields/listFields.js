module.exports = async function listFields(fastify) {
  fastify.get(
    "/products/:productId/fields",
    async (req, reply) => {
      // broker guard (same pattern as your other routes)
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const { productId } = req.params;

      // Optional: verify product belongs to broker
      const product = await fastify.prisma.brokerApplicationProduct.findFirst({
        where: {
          id: productId,
          brokerApplication: {
            brokerOrgId: req.user.organizationId,
          },
        },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          message: "Application product not found",
        });
      }

      const fields =
        await fastify.prisma.brokerApplicationProductField.findMany({
          where: {
            applicationProductId: productId,
          },
          orderBy: {
            sortOrder: "asc",
          },
        });

      return reply.send({
        success: true,
        data: fields,
      });
    }
  );
};
