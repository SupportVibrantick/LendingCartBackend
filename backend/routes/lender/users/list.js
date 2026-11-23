const {
  isLenderAdmin,
  formatLenderRoleLabel,
  LENDER_TEAM_ASSIGNABLE_ROLES,
} = require("../../../utils/lender/lenderTeamRoles");

module.exports = async function listLenderUsers(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Team Members"],
        summary: "List lender organization team members",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            search: { type: "string" },
            role: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        if (!isLenderAdmin(req.user)) {
          return reply.code(403).send({
            success: false,
            message: "Only lender admins can manage team members",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(
          Math.max(Number(req.query.limit) || 10, 1),
          100,
        );
        const skip = (page - 1) * limit;
        const search =
          typeof req.query.search === "string" ? req.query.search.trim() : "";
        const roleRaw =
          typeof req.query.role === "string" ? req.query.role.trim() : "";
        const role = LENDER_TEAM_ASSIGNABLE_ROLES.includes(roleRaw)
          ? roleRaw
          : "";

        const where = {
          organizationId: lenderOrgId,
          isDeleted: false,
        };

        if (search) {
          where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ];
        }

        if (role) {
          where.roles = {
            some: {
              role: { name: role },
            },
          };
        }

        const adminWhere = {
          organizationId: lenderOrgId,
          isDeleted: false,
          status: "ACTIVE",
          roles: {
            some: {
              role: { name: "LENDER_ADMIN" },
            },
          },
        };

        const [users, total, activeAdminCount] = await Promise.all([
          prisma.userAccount.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
              lastLoginAt: true,
              createdAt: true,
              roles: {
                take: 1,
                select: {
                  role: {
                    select: { name: true },
                  },
                },
              },
            },
          }),
          prisma.userAccount.count({ where }),
          prisma.userAccount.count({ where: adminWhere }),
        ]);

        const data = users.map((user) => {
          const roleName = user.roles[0]?.role?.name || null;

          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            status: user.status,
            displayStatus:
              user.status === "ACTIVE" && !user.lastLoginAt
                ? "INVITED"
                : user.status,
            role: roleName,
            roleLabel: formatLenderRoleLabel(roleName),
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
          };
        });

        return reply.send({
          success: true,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          activeAdminCount,
          data,
        });
      } catch (error) {
        fastify.log.error(error, "Failed to list lender team members");

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch team members",
        });
      }
    },
  );
};
