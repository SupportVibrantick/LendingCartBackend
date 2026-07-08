const fp = require("fastify-plugin");
const { getUserRolesFromFGA } = require("../../../services/auth/fgaService");
const { resolveUserPermissions } = require("../../../services/auth/adminUserPermissions.js");

module.exports = fp(async function adminUserReadRoutes(fastify) {
  fastify.get("/read", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const users = await prisma.userAccount.findMany({
        where: {
          roles: {
            some: {
              role: { name: "PLATFORM_ADMIN" },
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organizationId: true,
          status: true,
          createdAt: true,
          roles: { include: { role: true } },
          userPermissions: { include: { permission: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const mapped = [];

      for (const user of users) {
        const roleNames = user.roles.map((r) => r.role.name);
        let fgaRoles = [];
        try {
          fgaRoles = await getUserRolesFromFGA(user.id);
        } catch {
          fgaRoles = [];
        }

        const hasCustomPermissions = user.userPermissions.length > 0;
        const permissions = await resolveUserPermissions(prisma, user.id, roleNames);

        mapped.push({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          organizationId: user.organizationId,
          status: user.status,
          createdAt: user.createdAt,
          roles: roleNames,
          fgaRoles: fgaRoles.map((r) => r.replace("role:", "")),
          accessLevel: hasCustomPermissions ? "CUSTOM" : "FULL",
          permissions: hasCustomPermissions ? permissions : ["*"],
        });
      }

      return reply.send({ success: true, count: mapped.length, data: mapped, users: mapped });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Error retrieving PLATFORM_ADMIN users",
      });
    }
  });
});
