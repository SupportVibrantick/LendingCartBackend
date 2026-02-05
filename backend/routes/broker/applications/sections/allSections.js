/**
 * List all active sections for a Broker Application Product (Broker side)
 */
module.exports = async function allApplicationSections(fastify) {
  fastify.get("/", async (req, reply) => {
    const { productId } = req.params;
    const brokerOrgId = req.user.organizationId;

    /* ===============================
       VERIFY PRODUCT OWNERSHIP
    =============================== */
    const product =
      await fastify.prisma.brokerApplicationProduct.findFirst({
        where: {
          id: productId,
          brokerApplication: {
            brokerOrgId,
          },
        },
        select: { id: true },
      });

    if (!product) {
      return reply.code(404).send({
        success: false,
        message: "Product not found",
      });
    }

    /* ===============================
       FETCH SECTIONS
    =============================== */
    const sections =
      await fastify.prisma.brokerApplicationSection.findMany({
        where: {
          applicationProductId: productId,
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          fields: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

    reply.send({
      success: true,
      data: sections,
    });
  });
};
