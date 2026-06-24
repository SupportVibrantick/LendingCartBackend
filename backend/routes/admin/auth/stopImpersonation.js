const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/jwtSecret");
const { adminLogs } = require("../../../services/logger/contextLogger");

async function stopImpersonationRoute(fastify) {
  fastify.post(
    "/stop-impersonation",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!request.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const impersonatedBy = request.user.impersonatedBy;

        if (!impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "You are not in an impersonated session",
          });
        }

        const platformAdmin = await prisma.userAccount.findFirst({
          where: {
            id: impersonatedBy,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "PLATFORM_ADMIN" },
              },
            },
          },
          include: {
            roles: { include: { role: true } },
          },
        });

        if (!platformAdmin) {
          return reply.code(404).send({
            success: false,
            message: "Original admin account not found",
          });
        }

        const roleNames = platformAdmin.roles?.map((r) => r.role.name) ?? [];

        const newToken = jwt.sign(
          {
            userId: platformAdmin.id,
            orgId: platformAdmin.organizationId,
            roles: roleNames,
          },
          jwtSecret,
          { expiresIn: "7d" },
        );

        adminLogs.info("Impersonation stopped", {
          restoredAdminId: platformAdmin.id,
          previousUser: request.user.userId,
          ip: request.ip,
        });

        return reply.send({
          success: true,
          token: newToken,
          redirectTo: "/admin/dashboard",
        });
      } catch (err) {
        adminLogs.error("Stop impersonation failed", err);

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = stopImpersonationRoute;
