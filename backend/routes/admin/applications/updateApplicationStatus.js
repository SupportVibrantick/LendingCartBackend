module.exports = async function updateApplicationStatus(fastify) {
  fastify.patch("/:id/status", async (req, reply) => {
    const { id } = req.params;
    const { isActive, brokerOrgId } = req.body;

    // Validation
    if (typeof isActive !== "boolean") {
      return reply.code(400).send({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    // If activating one app, deactivate others for this broker
    if (isActive) {
      await fastify.prisma.brokerApplication.updateMany({
        where: { brokerOrgId },
        data: { isActive: false },
      });
    }

    const updated = await fastify.prisma.brokerApplication.update({
      where: { id },
      data: { isActive },
    });

    reply.send({ success: true, data: updated });
  });
};
