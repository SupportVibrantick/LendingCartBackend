const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const { isLenderAdmin } = require("../../../utils/lender/lenderTeamRoles");

/**
 * Restore the original lender admin session after viewing a team member.
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function stopLenderImpersonationRoute(fastify) {
  fastify.post(
    "/stop-impersonation",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Exit team member view mode and restore lender admin session",
      },
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
            message: "You are not in view mode",
          });
        }

        const originalAdmin = await prisma.userAccount.findFirst({
          where: {
            id: impersonatedBy,
            status: "ACTIVE",
            isDeleted: false,
            organizationId: request.user.organizationId,
            roles: {
              some: { role: { name: "LENDER_ADMIN" } },
            },
          },
          include: {
            organization: { select: { id: true, name: true } },
            roles: { include: { role: { select: { name: true } } } },
          },
        });

        if (!originalAdmin || !isLenderAdmin({ roles: originalAdmin.roles.map((r) => r.role.name) })) {
          return reply.code(404).send({
            success: false,
            message: "Original lender admin session not found",
            code: "NOT_LENDER_ADMIN_IMPERSONATION",
          });
        }

        const roles = originalAdmin.roles.map((r) => r.role.name);

        const token = jwt.sign(
          {
            id: originalAdmin.id,
            organizationId: originalAdmin.organizationId,
            orgType: "LENDER",
            roles,
            email: originalAdmin.email,
          },
          jwtSecret,
          {
            expiresIn: "7d",
            issuer: "lendingcart",
            audience: "lender-app",
          },
        );

        return reply.send({
          success: true,
          token,
          user: {
            id: originalAdmin.id,
            email: originalAdmin.email,
            name: `${originalAdmin.firstName || ""} ${originalAdmin.lastName || ""}`.trim(),
            organizationId: originalAdmin.organizationId,
            organizationName: originalAdmin.organization?.name || null,
            roles,
          },
          redirectTo: "/team-members",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, route: "lender-stop-impersonation" },
          "Stop lender impersonation failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to exit view mode",
        });
      }
    },
  );
};
