/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getActiveApplication(fastify) {
  fastify.get("/active", async (req, reply) => {
    const brokerOrgId = req.brokerOrgId;

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "Broker context not resolved",
      });
    }

    const application = await fastify.prisma.brokerApplication.findFirst({
      where: {
        brokerOrgId,
        isActive: true,
      },
      include: {
        products: {
          where: { isActive: true },
          select: { loanProductCode: true },
        },
      },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "No active application found",
      });
    }

    return reply.send({
      success: true,
      data: {
        applicationId: application.id,
        products: application.products.map(p => p.loanProductCode),
      },
    });
  });
};
