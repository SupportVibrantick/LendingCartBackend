const jwt = require("jsonwebtoken");
const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function stopImpersonationRoute(fastify) {
  fastify.post(
    "/stop-impersonation",
    {
      schema: {
        tags: ["Admin -> Auth"],
        summary: "Stop impersonation and restore PLATFORM_ADMIN session",
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { impersonatedBy } = request.user;

        // ✅ Check if this session is impersonation
        if (!impersonatedBy) {
          return reply.status(400).send({
            success: false,
            message: "You are not in an impersonated session",
          });
        }

        // ✅ Find original PLATFORM_ADMIN user
        const platformAdmin = await prisma.userAccount.findFirst({
          where: {
            id: impersonatedBy,
            status: "ACTIVE",
            roles: {
              some: {
                role: {
                  name: "PLATFORM_ADMIN",
                },
              },
            },
          },
        });

        if (!platformAdmin) {
          return reply.status(404).send({
            success: false,
            message: "Original admin account not found",
          });
        }

        // ✅ Generate new admin token
        const newToken = jwt.sign(
          {
            userId: platformAdmin.id,
            organizationId: platformAdmin.organizationId,
            organizationType: "PLATFORM",
          },
          process.env.JWT_SECRET,
          { expiresIn: "8h" }
        );

        adminLogs.info("Impersonation stopped", {
          restoredAdminId: platformAdmin.id,
          fromUser: request.user.userId,
        });

        return reply.send({
          success: true,
          message: "Impersonation stopped successfully",
          token: newToken,
          redirectTo: "/admin/dashboard",
        });
      } catch (error) {
        adminLogs.error("Stop impersonation failed", error);

        return reply.status(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
}

module.exports = stopImpersonationRoute;