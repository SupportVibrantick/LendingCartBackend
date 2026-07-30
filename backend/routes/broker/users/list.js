// backend/routes/broker/users/list.js
const {
  mergeBrokerProfileResponse,
} = require("../../../utils/broker/brokerUserProfileHelpers");
const {
  formatAssignedSubBrokers,
} = require("../../../utils/broker/subBrokerProfileHelpers");

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
            role: { type: "string" },
            sortBy: {
              type: "string",
              enum: ["name", "email", "phone", "status", "createdAt"],
              default: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
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

        const {
          page = 1,
          limit = 10,
          search,
          status,
          role,
          sortBy = "createdAt",
          sortOrder = "desc",
        } = req.query;

        const skip = (page - 1) * limit;
        const order = sortOrder === "asc" ? "asc" : "desc";

        /* =====================================================
           3️⃣ BUILD FILTER
        ===================================================== */

        const searchFilter = search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {};

        const roleFilter = role
          ? {
              roles: {
                some: {
                  role: { name: role },
                },
              },
            }
          : {};

        const where = {
          organizationId: brokerOrgId,
          isDeleted: false,
          ...roleFilter,
          ...(status ? { status } : {}),
          ...searchFilter,
        };

        let orderBy;
        switch (sortBy) {
          case "name":
            orderBy = [{ firstName: order }, { lastName: order }];
            break;
          case "email":
            orderBy = { email: order };
            break;
          case "phone":
            orderBy = { phone: order };
            break;
          case "status":
            orderBy = { status: order };
            break;
          default:
            orderBy = { createdAt: order };
        }

        const statsBaseWhere = {
          organizationId: brokerOrgId,
          isDeleted: false,
          ...roleFilter,
          ...searchFilter,
        };

        /* =====================================================
           4️⃣ FETCH USERS + PROFILE + ROLES + PERMISSIONS
        ===================================================== */

        const queries = [
          prisma.userAccount.findMany({
            where,
            skip,
            take: limit,
            orderBy,
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
              loanOfficerSubBrokers: {
                include: {
                  subBroker: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      profileImage: true,
                    },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          }),
          prisma.userAccount.count({ where }),
        ];

        if (role) {
          queries.push(
            prisma.userAccount.count({ where: statsBaseWhere }),
            prisma.userAccount.count({
              where: { ...statsBaseWhere, status: "ACTIVE" },
            }),
            prisma.userAccount.count({
              where: { ...statsBaseWhere, status: "DISABLED" },
            }),
          );
        }

        const results = await prisma.$transaction(queries);
        const users = results[0];
        const total = results[1];
        const statsTotal = role ? results[2] : null;
        const activeCount = role ? results[3] : null;
        const disabledCount = role ? results[4] : null;

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
          assignedCoBrokers: formatAssignedSubBrokers(u.loanOfficerSubBrokers),

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
          totalPages: Math.ceil(total / limit) || 1,
          stats: role
            ? {
                total: statsTotal,
                active: activeCount,
                disabled: disabledCount,
              }
            : undefined,
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

