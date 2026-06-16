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
            brokerProfile: true,
          },
        });

        if (!user || user.organizationId !== organizationId) {
          return reply.code(404).send({
            ok: false,
            message: "User not found",
          });
        }

        const applicationCount = await prisma.loanApplication.count({
          where: { brokerOrgId: organizationId },
        });

        return reply.send({
          ok: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
              phone: user.phone,
              profileImage: user.profileImage || null,
              status: user.status,
              roles: user.roles.map((r) => r.role.name),
              applicationCount,
              brokerProfile: user.brokerProfile
                ? {
                    company: user.brokerProfile.company,
                    tollFree: user.brokerProfile.tollFree,
                    tollFreeExt: user.brokerProfile.tollFreeExt,
                    serviceProvider: user.brokerProfile.serviceProvider,
                    address: user.brokerProfile.address,
                    suite: user.brokerProfile.suite,
                    city: user.brokerProfile.city,
                    state: user.brokerProfile.state,
                    zipCode: user.brokerProfile.zipCode,
                    agentType: user.brokerProfile.agentType,
                    licenseNumber: user.brokerProfile.licenseNumber,
                    preferredComm: user.brokerProfile.preferredComm,
                    website: user.brokerProfile.website,
                  }
                : null,
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
    },
  );
}

module.exports = brokerMeRoutes;
