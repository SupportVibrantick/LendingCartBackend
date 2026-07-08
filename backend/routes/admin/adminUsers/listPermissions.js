const fp = require("fastify-plugin");
const {
  ADMIN_PERMISSION_GROUPS,
  formatPermissionLabel,
} = require("../../../services/auth/adminUserPermissions.js");

module.exports = fp(async function listAdminPermissionsRoutes(fastify) {
  fastify.get("/permissions", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const allKeys = ADMIN_PERMISSION_GROUPS.flatMap((g) => g.keys);
      const dbPermissions = await prisma.permission.findMany({
        where: { key: { in: allKeys } },
        select: { id: true, key: true, description: true },
      });

      const permMap = Object.fromEntries(dbPermissions.map((p) => [p.key, p]));

      const groups = ADMIN_PERMISSION_GROUPS.map((group) => ({
        label: group.label,
        permissions: group.keys
          .filter((key) => permMap[key])
          .map((key) => ({
            key,
            label: formatPermissionLabel(key),
            description: permMap[key].description,
          })),
      }));

      return reply.send({ success: true, data: groups });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Failed to load permissions",
      });
    }
  });
});
