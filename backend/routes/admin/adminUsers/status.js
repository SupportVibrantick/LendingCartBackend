const fp = require("fastify-plugin");

module.exports = fp(async function adminUserStatusRoutes(fastify) {
  fastify.patch("/status/:id", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (request, reply) => {
    const prisma = fastify.prisma;
    const { id } = request.params;
    const { status } = request.body;

    const normalizedStatus =
      status === "INACTIVE" ? "DISABLED" : status;

    if (!["ACTIVE", "DISABLED"].includes(normalizedStatus)) {
      return reply.code(400).send({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    try {
      const existing = await prisma.userAccount.findFirst({
        where: {
          id,
          roles: { some: { role: { name: "PLATFORM_ADMIN" } } },
        },
      });

      if (!existing) {
        return reply.code(404).send({ success: false, message: "Admin user not found" });
      }

      const updated = await prisma.userAccount.update({
        where: { id },
        data: { status: normalizedStatus },
      });

      return reply.send({
        success: true,
        message: "Status updated",
        user: { id: updated.id, status: updated.status },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ success: false, message: "Internal server error" });
    }
  });
});
