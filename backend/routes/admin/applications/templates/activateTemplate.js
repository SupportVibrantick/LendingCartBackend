module.exports = async function activateTemplate(fastify) {
  fastify.patch("/:id/status", async (req, reply) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return reply.code(400).send({
        success: false,
        message: "isActive must be boolean",
      });
    }

    const template = await fastify.prisma.applicationTemplate.update({
      where: { id },
      data: { isActive },
    });

    reply.send({ success: true, data: template });
  });
};
