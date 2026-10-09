const fp = require("fastify-plugin");
const {
  resolveUserPermissions,
} = require("../../../services/auth/adminUserPermissions.js");
const { parsePagination } = require("../../../utils/pagination");

function normalizeStatusFilter(raw) {
  const value = String(raw || "ALL").toUpperCase();
  if (value === "ACTIVE") return "ACTIVE";
  if (value === "INACTIVE" || value === "DISABLED") return "DISABLED";
  return null;
}

function normalizeAccessFilter(raw) {
  const value = String(raw || "ALL").toUpperCase();
  if (value === "FULL" || value === "CUSTOM") return value;
  return null;
}

/** Build Prisma OR clauses for name/email search (supports multi-word full names). */
function buildSearchWhere(search) {
  const q = String(search || "").trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  const clauses = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
  ];

  if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens.slice(1).join(" ");
    clauses.push({
      AND: [
        { firstName: { contains: first, mode: "insensitive" } },
        { lastName: { contains: last, mode: "insensitive" } },
      ],
    });
    clauses.push({
      AND: [
        { firstName: { contains: last, mode: "insensitive" } },
        { lastName: { contains: first, mode: "insensitive" } },
      ],
    });
  }

  return { OR: clauses };
}

module.exports = fp(async function adminUserReadRoutes(fastify) {
  const guard = [
    fastify.authenticate,
    fastify.verifySuperAdmin,
    fastify.requirePermission(["MANAGE_PERMISSIONS", "VIEW_USERS"]),
  ];

  fastify.get("/read", { preHandler: guard }, async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const { skip, take, page, limit } = parsePagination(req.query);
      const search = String(req.query.search || req.query.q || "").trim();
      const statusFilter = normalizeStatusFilter(req.query.status);
      const accessFilter = normalizeAccessFilter(req.query.accessLevel);

      const baseWhere = {
        NOT: { isDeleted: true },
        roles: {
          some: {
            role: { name: "PLATFORM_ADMIN" },
          },
        },
      };

      const where = { ...baseWhere };

      if (statusFilter) {
        where.status = statusFilter;
      }

      const searchWhere = buildSearchWhere(search);
      if (searchWhere) {
        Object.assign(where, searchWhere);
      }

      // Access level is derived from UserPermission presence — pre-filter via relation.
      if (accessFilter === "CUSTOM") {
        where.userPermissions = { some: {} };
      } else if (accessFilter === "FULL") {
        where.userPermissions = { none: {} };
      }

      const [total, users, allForStats] = await Promise.all([
        prisma.userAccount.count({ where }),
        prisma.userAccount.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            organizationId: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            roles: { include: { role: true } },
            userPermissions: { include: { permission: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.userAccount.findMany({
          where: baseWhere,
          select: {
            status: true,
            userPermissions: { select: { id: true }, take: 1 },
          },
        }),
      ]);

      const mapped = [];

      for (const user of users) {
        const roleNames = user.roles.map((r) => r.role.name);
        const hasCustomPermissions = user.userPermissions.length > 0;
        const permissions = await resolveUserPermissions(
          prisma,
          user.id,
          roleNames,
        );

        mapped.push({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          organizationId: user.organizationId,
          status: user.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          roles: roleNames,
          accessLevel: hasCustomPermissions ? "CUSTOM" : "FULL",
          permissions: hasCustomPermissions ? permissions : ["*"],
          permissionCount: hasCustomPermissions ? permissions.length : null,
        });
      }

      const stats = {
        total: allForStats.length,
        active: allForStats.filter((u) => u.status === "ACTIVE").length,
        inactive: allForStats.filter((u) => u.status !== "ACTIVE").length,
        fullAccess: allForStats.filter((u) => u.userPermissions.length === 0)
          .length,
        customAccess: allForStats.filter((u) => u.userPermissions.length > 0)
          .length,
      };

      return reply.send({
        success: true,
        data: mapped,
        stats,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit) || 1),
          hasMore: skip + users.length < total,
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

  fastify.get("/read/:id", { preHandler: guard }, async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    try {
      const user = await prisma.userAccount.findFirst({
        where: {
          id,
          NOT: { isDeleted: true },
          roles: { some: { role: { name: "PLATFORM_ADMIN" } } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organizationId: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          roles: { include: { role: true } },
          userPermissions: { include: { permission: true } },
        },
      });

      if (!user) {
        return reply
          .code(404)
          .send({ success: false, message: "Admin user not found" });
      }

      const roleNames = user.roles.map((r) => r.role.name);
      const hasCustomPermissions = user.userPermissions.length > 0;
      const permissions = await resolveUserPermissions(
        prisma,
        user.id,
        roleNames,
      );

      return reply.send({
        success: true,
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          organizationId: user.organizationId,
          status: user.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          roles: roleNames,
          accessLevel: hasCustomPermissions ? "CUSTOM" : "FULL",
          permissions: hasCustomPermissions ? permissions : ["*"],
          permissionCount: hasCustomPermissions ? permissions.length : null,
        },
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Error retrieving admin user",
      });
    }
  });
});
