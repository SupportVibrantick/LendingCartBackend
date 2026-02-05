module.exports = async function deleteField(fastify) {
  fastify.delete("/fields/:fieldId", async (req, reply) => {
    const { fieldId } = req.params;
    const { brokerOrgId } = req.query;

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
       1. VERIFY FIELD OWNERSHIP
    =============================== */

    const field =
      await fastify.prisma.brokerApplicationProductField.findFirst({
        where: {
          id: fieldId,
          applicationProduct: {
            brokerApplication: {
              brokerOrgId,
            },
          },
        },
        select: { id: true },
      });

    if (!field) {
      return reply.code(404).send({
        success: false,
        message: "Field not found for this broker",
      });
    }

    /* ===============================
       2. DELETE FIELD
    =============================== */

    await fastify.prisma.brokerApplicationProductField.delete({
      where: { id: fieldId },
    });

    reply.send({
      success: true,
      message: "Field deleted successfully",
    });
  });
};
