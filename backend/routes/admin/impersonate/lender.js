// routes/admin/organizations/lenders.js

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
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        // ✅ Check PLATFORM_ADMIN role
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

        // ✅ Fetch Lenders
        const lenders = await prisma.organization.findMany({
          where: {
            type: "LENDER",
            isDeleted: false,
          },
          select: {
            id: true,
            name: true,
            users: {
              where: {
                status: "ACTIVE",
                roles: {
                  some: {
                    role: {
                      name: "LENDER_ADMIN",
                    },
                  },
                },
              },
              select: {
                email: true,
              },
              take: 1,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const formatted = lenders.map((org) => ({
          organizationId: org.id,
          name: org.name,
          profileImage: null, // no org-level profile image in schema
          adminEmail: org.users?.[0]?.email || null,
        }));

        return reply.send({
          success: true,
          count: formatted.length,
          data: formatted,
        });
      } catch (error) {
        adminLogs.error("Failed to fetch lenders", error);

        return reply.status(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
}

module.exports = listLendersRoute;