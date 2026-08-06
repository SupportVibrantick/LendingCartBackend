const {
  formatAssignedLoanOfficers,
} = require("../../../utils/broker/subBrokerProfileHelpers");
const {
  requireLoOfficerPermission,
} = require("../../../services/broker/loanOfficerAccess");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubBrokersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "List Sub Brokers",
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
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(req, reply, fastify, "VIEW_CO_BROKERS");
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (!req.user.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];
        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];
        const hasAccess = roles.some((role) => allowedRoles.includes(role));

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;

        const {
          page = 1,
          limit = 10,
          search,
          status,
          sortBy = "createdAt",
          sortOrder = "desc",
        } = req.query;

        const skip = (page - 1) * limit;
        const order = sortOrder === "asc" ? "asc" : "desc";

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

        const roleFilter = {
          roles: {
            some: {
              role: {
                name: "SUB_BROKER",
              },
            },
          },
        };

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

        const results = await prisma.$transaction([
          prisma.userAccount.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
              createdAt: true,
              createdById: true,
              subBrokerLoanOfficers: {
                include: {
                  loanOfficer: {
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
          prisma.userAccount.count({ where: statsBaseWhere }),
          prisma.userAccount.count({
            where: { ...statsBaseWhere, status: "ACTIVE" },
          }),
          prisma.userAccount.count({
            where: { ...statsBaseWhere, status: "DISABLED" },
          }),
        ]);

        const users = results[0];
        const total = results[1];
        const statsTotal = results[2];
        const activeCount = results[3];
        const disabledCount = results[4];

        const data = users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: u.status,
          createdAt: u.createdAt,
          createdById: u.createdById,
          assignedLoanOfficers: formatAssignedLoanOfficers(u.subBrokerLoanOfficers),
        }));

        return reply.send({
          success: true,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          stats: {
            total: statsTotal,
            active: activeCount,
            disabled: disabledCount,
          },
          data,
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "List sub brokers failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
