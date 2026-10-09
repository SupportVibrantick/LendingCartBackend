const fp = require("fastify-plugin");
const {
  ALL_ADMIN_PERMISSION_KEYS,
  buildPermissionCatalog,
} = require("../../../services/auth/adminUserPermissions.js");

module.exports = fp(async function listAdminPermissionsRoutes(fastify) {
  fastify.get(
    "/permissions",
    {
      preHandler: [
        fastify.authenticate,
        fastify.verifySuperAdmin,
        fastify.requirePermission("MANAGE_PERMISSIONS"),
      ],
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const dbPermissions = await prisma.permission.findMany({
          where: { key: { in: ALL_ADMIN_PERMISSION_KEYS } },
          select: { id: true, key: true, description: true },
        });

        const groups = buildPermissionCatalog(dbPermissions);

        return reply.send({
          success: true,
          data: groups,
          meta: {
            totalPermissions: groups.reduce(
              (sum, group) => sum + group.permissions.length,
              0,
            ),
            totalModules: groups.length,
          },
        });
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({
          success: false,
          message: "Failed to load permissions",
        });
      }
    },
  );
});
