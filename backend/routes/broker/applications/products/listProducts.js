module.exports = async function listProducts(fastify) {
  fastify.get("/:applicationId/products", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      if (req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const { applicationId } = req.params;

      const products = await prisma.brokerApplicationProduct.findMany({
        where: {
          brokerApplicationId: applicationId,

          // ✅ CRITICAL FIX
          brokerApplication: {
            brokerOrgId: brokerOrgId,
            isActive: true,
          },
        },
      });

      return reply.send({
        success: true,
        data: products,
      });

    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Server error",
      });
    }
  });
};