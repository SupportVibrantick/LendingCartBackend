// routes/admin/impersonate/lender.js

const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLendersRoute(fastify) {
  fastify.get(
    "/lenders",
    {
      schema: {
        tags: ["Admin -> Organizations"],
        summary: "List lenders for impersonation view",
        querystring: {
          type: "object",
          properties: {
            page: { type: "string" },
            limit: { type: "string" },
            search: { type: "string" },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const platformAdmin = await prisma.userRole.findFirst({
          where: {
            userId: request.user.userId,
            role: {
              name: "PLATFORM_ADMIN",
            },
          },
        });

        if (!platformAdmin) {
          return reply.status(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const q = request.query || {};
        const page = Math.max(parseInt(q.page || "1", 10) || 1, 1);
        const limit = Math.min(
          Math.max(parseInt(q.limit || "10", 10) || 10, 1),
          100,
        );
        const skip = (page - 1) * limit;
        const search = String(q.search || "").trim();

        const lenderAdminUserFilter = {
          status: "ACTIVE",
          email: { not: "" },
          roles: {
            some: {
              role: {
                name: "LENDER_ADMIN",
              },
            },
          },
        };

        const where = {
          type: "LENDER",
          isDeleted: false,
          // Only lenders that can be impersonated (have an admin with email)
          users: {
            some: lenderAdminUserFilter,
          },
          ...(search
            ? {
                AND: [
                  {
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      {
                        users: {
                          some: {
                            ...lenderAdminUserFilter,
                            email: {
                              contains: search,
                              mode: "insensitive",
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              }
            : {}),
        };

        const [lenders, total] = await prisma.$transaction([
          prisma.organization.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              users: {
                where: lenderAdminUserFilter,
                select: {
                  email: true,
                },
                take: 1,
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
          prisma.organization.count({ where }),
        ]);

        const formatted = lenders.map((org) => ({
          organizationId: org.id,
          name: org.name,
          profileImage: null,
          adminEmail: org.users?.[0]?.email || null,
        }));

        const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

        return reply.send({
          success: true,
          data: formatted,
          meta: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      } catch (error) {
        adminLogs.error("Failed to fetch lenders", error);

        return reply.status(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
}

module.exports = listLendersRoute;
