const {
  isLenderAdmin,
  formatLenderRoleLabel,
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
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            search: { type: "string" },
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
        const { page = 1, limit = 50, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {
          organizationId: lenderOrgId,
          isDeleted: false,
        };

        if (search?.trim()) {
          const term = search.trim();
          where.OR = [
            { email: { contains: term, mode: "insensitive" } },
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
          ];
        }

        const [users, total] = await Promise.all([
          prisma.userAccount.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              roles: {
                include: {
                  role: {
                    select: { name: true },
                  },
                },
              },
            },
          }),
          prisma.userAccount.count({ where }),
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
          totalPages: Math.ceil(total / limit),
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
