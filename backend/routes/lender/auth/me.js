// backend/routes/lender/auth/me.js
/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderMeRoutes(fastify) {
  fastify.get(
    "/me",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Get logged-in lender user profile",
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
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            profileImage: user.profileImage || null, 
            status: user.status,
            organization: {
              id: user.organization.id,
              name: user.organization.name,
              type: user.organization.type,
              status: user.organization.status,
            },
            roles: user.roles.map((r) => r.role.name),
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch user profile",
        });
      }
    }
  );
}

module.exports = lenderMeRoutes;
