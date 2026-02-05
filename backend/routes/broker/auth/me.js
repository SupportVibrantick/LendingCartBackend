// backend/routes/broker/auth/me.js

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerMeRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Get logged-in broker user",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { userId, organizationId } = request.user;

        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: {
            organization: true,
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || user.organizationId !== organizationId) {
          return reply.code(404).send({
            ok: false,
            message: "User not found",
          });
        }

        return reply.send({
          ok: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
              profileImage: user.profileImage || null,
              status: user.status,
              roles: user.roles.map((r) => r.role.name),
            },

            organization: {
              id: user.organization.id,
              name: user.organization.name,
              type: user.organization.type,
              status: user.organization.status,
            },
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch broker profile",
        });
      }
    }
  );
}

module.exports = brokerMeRoutes;