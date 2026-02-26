// routes/admin/organizations/brokers.js

const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listBrokersRoute(fastify) {
  fastify.get(
    "/brokers",
    {
      schema: {
        tags: ["Admin -> Organizations"],
        summary: "List brokers for impersonation view",
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        // ✅ Check PLATFORM_ADMIN role properly
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

        // ✅ Correct relation name = users
        const brokers = await prisma.organization.findMany({
          where: {
            type: "BROKER",
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
                      name: "BROKER_ADMIN",
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

        const formatted = brokers.map((org) => ({
          organizationId: org.id,
          name: org.name,
          profileImage: null, // no org profile image in schema
          adminEmail: org.users?.[0]?.email || null,
        }));

        return reply.send({
          success: true,
          count: formatted.length,
          data: formatted,
        });
      } catch (error) {
        adminLogs.error("Failed to fetch brokers", error);

        return reply.status(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
}

module.exports = listBrokersRoute;