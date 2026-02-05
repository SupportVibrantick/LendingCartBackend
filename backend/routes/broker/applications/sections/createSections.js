module.exports = async function createSection(fastify) {
  fastify.post("/", async (req, reply) => {
    const { productId } = req.params;
    const { name, description, sortOrder } = req.body;

    const brokerOrgId = req.user.organizationId;

    /* ===============================
       VALIDATION
    =============================== */
    if (!name || typeof name !== "string" || !name.trim()) {
      return reply.code(400).send({
        success: false,
        message: "Section name is required",
      });
    }

    const order =
      typeof sortOrder === "number" && sortOrder >= 0 ? sortOrder : 0;

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
       CREATE SECTION
    =============================== */
    try {
      const section =
        await fastify.prisma.brokerApplicationSection.create({
          data: {
            applicationProductId: productId,
            name: name.trim(),
            description,
            sortOrder: order,
            isActive: true,
          },
        });

      return reply.code(201).send({
        success: true,
        data: section,
      });
    } catch (err) {
      // Unique constraint: (applicationProductId, name)
      if (err.code === "P2002") {
        return reply.code(409).send({
          success: false,
          message: "Section with this name already exists",
        });
      }

      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Failed to create section",
      });
    }
  });
};
