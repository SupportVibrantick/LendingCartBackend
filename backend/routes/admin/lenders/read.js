// routes/admin/lenders/read.js
const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 */
async function readLendersRoutes(fastify) {
  /**
   * GET / - list lenders
   * Query params:
   *  - page (int, default 1)
   *  - limit (int, default 20)
   *  - search (string, optional; matches name/email/phone)
   */
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "List lenders (paginated)",
        description: "Returns a paginated list of lender organizations. Supports simple search on name/email/phone.",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const page = Math.max(1, parseInt(request.query.page || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20", 10)));
        const offset = (page - 1) * limit;
        const search = (request.query.search || "").trim();

        // base filter: only LENDER orgs and not soft-deleted
        const baseWhere = {
          type: "LENDER",
          isDeleted: { not: true },
        };

        // add search filter if provided
        const where = search
          ? {
              AND: [
                baseWhere,
                {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search, mode: "insensitive" } },
                  ],
                },
              ],
            }
          : baseWhere;

        // fetch data + total count
        const [total, orgs] = await Promise.all([
          prisma.organization.count({ where }),
          prisma.organization.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              // include a small users list (non-sensitive)
              users: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                  createdAt: true,
                  profileImage: true,
                },
                take: 3,
              },
              // include any broker accesses where this org is the lender (list of brokers)
              brokerLenderAccessAsLender: {
                select: {
                  id: true,
                  brokerOrgId: true,
                  source: true,
                  isActive: true,
                  createdAt: true,
                  broker: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      phone: true,
                      status: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

        // For each org try to identify the admin user (LENDER_ADMIN) if exists.
        const orgsWithAdmin = await Promise.all(
          orgs.map(async (org) => {
            try {
              const userRole = await prisma.userRole.findFirst({
                where: {
                  role: { name: "LENDER_ADMIN" },
                  user: { organizationId: org.id },
                },
                include: {
                  user: {
                    select: { id: true, email: true, firstName: true, lastName: true, status: true },
                  },
                },
              });

              const adminUser = userRole ? userRole.user : null;

              return {
                ...org,
                adminUser,
              };
            } catch (err) {
              adminLogs.error("Error resolving lender admin user", { orgId: org.id, err: err.message });
              return { ...org, adminUser: null };
            }
          })
        );

        return reply.send({
          success: true,
          data: {
            total,
            page,
            limit,
            results: orgsWithAdmin,
          },
        });
      } catch (error) {
        adminLogs.error("Failed to list lenders", error);
        return reply.status(500).send({
          success: false,
          message: "Server error occurred while fetching lenders.",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );

  /**
   * GET /:id - lender detail
   * Returns organization info, all users, broker accesses, lender products, and basic stats
   */
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Get lender details",
        description: "Returns lender organization details, users, broker accesses and lender products.",
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const id = request.params.id;

        const org = await prisma.organization.findFirst({
          where: {
            id,
            type: "LENDER",
            isDeleted: { not: true },
          },
          include: {
            // all users (non-sensitive)
            users: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            // broker accesses where this org is the lender
            brokerLenderAccessAsLender: {
              include: {
                broker: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    status: true,
                  },
                },
              },
            },
            // lender products
            lenderProducts: {
              select: {
                id: true,
                loanProductCode: true,
                minLoanAmount: true,
                maxLoanAmount: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
        });

        if (!org) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // identify lender admin user (if any)
        const userRole = await prisma.userRole.findFirst({
          where: {
            role: { name: "LENDER_ADMIN" },
            user: { organizationId: id },
          },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
          },
        });

        const adminUser = userRole ? userRole.user : null;

        // basic stats
        const [applicationsCount, productsCount] = await Promise.all([
          // adjust this query if you keep lender-scoped applications; left generic for now
          prisma.loanApplication.count({ where: {} }).catch(() => 0),
          Promise.resolve(org.lenderProducts ? org.lenderProducts.length : 0),
        ]);

        return reply.send({
          success: true,
          data: {
            organization: org,
            adminUser,
            stats: {
              totalLenderProducts: productsCount,
              totalLoanApplications: applicationsCount,
            },
          },
        });
      } catch (error) {
        adminLogs.error("Failed to fetch lender detail", error);
        return reply.status(500).send({
          success: false,
          message: "Server error occurred while fetching lender details.",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );
}

module.exports = readLendersRoutes;
