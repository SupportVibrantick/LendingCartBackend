module.exports = async function listFields(fastify) {
  fastify.get("/products/:productId/fields", async (req, reply) => {
    const { productId } = req.params;
    const { brokerOrgId } = req.query;

    /* ===============================
       1. ADMIN CONTEXT VALIDATION
    =============================== */

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    /* ===============================
       2. VERIFY OWNERSHIP (ADMIN SAFETY)
    =============================== */

    const product = await fastify.prisma.brokerApplicationProduct.findFirst({
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
        message: "Application product not found for this broker",
      });
    }

    /* ===============================
       3. FETCH SECTIONS WITH FIELDS
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

    return reply.send({
      success: true,
      data: sections,
    });
  });
};
