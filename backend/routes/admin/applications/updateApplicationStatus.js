module.exports = async function updateApplicationStatus(fastify) {
  fastify.patch("/:id/status", async (req, reply) => {
    const { id } = req.params;
    const { isActive, brokerOrgId } = req.body;

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

    const application = await fastify.prisma.brokerApplication.findFirst({
      where: { id, brokerOrgId },
      select: { id: true },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Application not found for this broker",
      });
    }

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
