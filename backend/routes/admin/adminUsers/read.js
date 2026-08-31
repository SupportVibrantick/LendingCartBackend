const fp = require("fastify-plugin");
const { resolveUserPermissions } = require("../../../services/auth/adminUserPermissions.js");

module.exports = fp(async function adminUserReadRoutes(fastify) {
  fastify.get("/read", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const { skip, take, page, limit } = require("../../../utils/pagination").parsePagination(req.query);

      const [total, users] = await Promise.all([
        prisma.userAccount.count({
          where: {
            roles: {
              some: {
                role: { name: "PLATFORM_ADMIN" },
              },
            },
          },
        }),
        prisma.userAccount.findMany({
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
          skip,
          take,
        }),
      ]);

      const mapped = [];


      for (const user of users) {
        const roleNames = user.roles.map((r) => r.role.name);

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
          accessLevel: hasCustomPermissions ? "CUSTOM" : "FULL",
          permissions: hasCustomPermissions ? permissions : ["*"],
        });
      }

      return reply.send({
        success: true,
        data: mapped,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: users.length === limit,
        },
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Error retrieving PLATFORM_ADMIN users",
      });
    }
  });
});
