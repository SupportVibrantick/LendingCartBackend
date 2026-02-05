module.exports = async function updateApplication(fastify) {
  fastify.put("/:id", async (req, reply) => {
    const { id } = req.params;
    const { name, isActive } = req.body;

    if (!name || typeof name !== "string") {
      return reply.code(400).send({
        success: false,
        message: "Application name is required",
      });
    }

    // check app exists & belongs to broker
    const existingApp =
      await fastify.prisma.brokerApplication.findFirst({
        where: {
          id,
          brokerOrgId: req.user.organizationId,
        },
      });

    if (!existingApp) {
      return reply.code(404).send({
        success: false,
        message: "Application not found",
      });
    }

    const baseCode = generateCode(name);
    let code = baseCode;
    let counter = 1;

    // ensure uniqueness (exclude current app)
    while (
      await fastify.prisma.brokerApplication.findFirst({
        where: {
          brokerOrgId: req.user.organizationId,
          code,
          NOT: { id },
        },
      })
    ) {
      code = `${baseCode}-${counter++}`;
    }

    const updatedApp =
      await fastify.prisma.brokerApplication.update({
        where: { id },
        data: {
          name,
          code,
          ...(typeof isActive === "boolean" && { isActive }),
        },
      });

    reply.send({ success: true, data: updatedApp });
  });
};

function generateCode(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}