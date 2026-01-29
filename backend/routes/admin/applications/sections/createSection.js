/**
 * Create Section for Broker Application Product (Admin)
 */
module.exports = async function createApplicationSection(fastify) {
  fastify.post("/", async (req, reply) => {
    const { productId } = req.params;
    const { brokerOrgId, name, description, sortOrder } = req.body;

    /* ===============================
       0. ADMIN CONTEXT VALIDATION
    =============================== */

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    /* ===============================
       1. BASIC VALIDATION
    =============================== */

    if (!name) {
      return reply.code(400).send({
        success: false,
        message: "section name is required",
      });
    }

    /* ===============================
       2. VERIFY PRODUCT OWNERSHIP
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
        message: "Product not found for this broker",
      });
    }

    /* ===============================
       3. CREATE SECTION
    =============================== */

    const section =
      await fastify.prisma.brokerApplicationSection.create({
        data: {
          applicationProductId: productId,
          name,
          description: description || null,
          sortOrder: sortOrder ?? null,
        },
      });

    reply.send({
      success: true,
      data: section,
    });
  });
};
