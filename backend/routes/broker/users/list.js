// backend/routes/broker/users/list.js
const {
  mergeBrokerProfileResponse,
} = require("../../../utils/brokerUserProfileHelpers");

module.exports = async function listBrokerUsers(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "List Loan Officers under broker (Full Profile)",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            search: { type: "string" },
            status: {
              type: "string",
              enum: ["ACTIVE", "INVITED", "DISABLED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* =====================================================
           1️⃣ AUTHORIZATION
        ===================================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can view users",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* =====================================================
           2️⃣ QUERY PARAMS
        ===================================================== */

        const { page = 1, limit = 10, search, status } = req.query;

        const skip = (page - 1) * limit;

        /* =====================================================
           3️⃣ BUILD FILTER
        ===================================================== */

        const where = {
          organizationId: brokerOrgId,
          isDeleted: false,
        };

        if (status) {
          where.status = status;
        }

        if (search) {
          where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ];
        }

        /* =====================================================
           4️⃣ FETCH USERS + PROFILE + ROLES + PERMISSIONS
        ===================================================== */

        const [users, total] = await prisma.$transaction([
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
              brokerProfile: true,

              // ✅ NEW: include permissions
              userPermissions: {
                include: {
                  permission: {
                    select: { key: true },
                  },
                },
              },
              _count: {
                select: { brokerLoanApplications: true },
              },
            },
          }),
          prisma.userAccount.count({ where }),
        ]);

        /* =====================================================
           5️⃣ FORMAT RESPONSE
        ===================================================== */

        const formattedUsers = users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: u.status,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          assignedDeals: u._count.brokerLoanApplications,

          roles: u.roles.map((r) => r.role.name),

          // ✅ NEW: map permissions
          permissions: u.userPermissions.map((p) => p.permission.key),

          profile: mergeBrokerProfileResponse(u.brokerProfile),
        }));

        /* =====================================================
           6️⃣ SUCCESS RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          data: formattedUsers,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            brokerOrgId: req.user?.organizationId,
          },
          "Failed to list broker users"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching users",
        });
      }
    }
  );
};

