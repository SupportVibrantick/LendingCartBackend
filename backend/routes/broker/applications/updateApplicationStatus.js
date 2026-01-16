module.exports = async function updateApplicationStatus(fastify) {
  fastify.patch("/:id/status", async (req, reply) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive) {
      await fastify.prisma.brokerApplication.updateMany({
        where: { brokerOrgId: req.user.organizationId },
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
