const fp = require("fastify-plugin");
const { adminLogs } = require("../../../services/logger/contextLogger.js");

module.exports = fp(async function adminUserStatusRoutes(fastify) {
  fastify.patch(
    "/status/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.verifySuperAdmin,
        fastify.requirePermission(["MANAGE_PERMISSIONS", "UPDATE_USER"]),
      ],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { id } = request.params;
      const { status } = request.body || {};
      const actorId = request.user?.userId || request.user?.id;

      const normalizedStatus = status === "INACTIVE" ? "DISABLED" : status;

      if (!["ACTIVE", "DISABLED"].includes(normalizedStatus)) {
        return reply.code(400).send({
          success: false,
          message: "Status must be ACTIVE or INACTIVE",
        });
      }

      if (actorId && id === actorId && normalizedStatus === "DISABLED") {
        return reply.code(400).send({
          success: false,
          message: "You cannot deactivate your own account",
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
          return reply
            .code(404)
            .send({ success: false, message: "Admin user not found" });
        }

        const updated = await prisma.userAccount.update({
          where: { id },
          data: { status: normalizedStatus },
        });

        adminLogs.info("Admin user status updated", {
          actorId,
          userId: id,
          status: updated.status,
        });

        return reply.send({
          success: true,
          message: "Status updated",
          user: { id: updated.id, status: updated.status },
        });
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ success: false, message: "Internal server error" });
      }
    },
  );
});
