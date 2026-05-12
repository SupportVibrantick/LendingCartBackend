async function subBrokerMeRoutes(
  fastify,
) {
  fastify.get(
    "/me",
    {
      preHandler:
        fastify.authenticate,

      schema: {
        tags: [
          "Sub Broker -> Auth",
        ],

        summary:
          "Get logged-in sub broker user",
      },
    },

    async (request, reply) => {
      const prisma =
        fastify.prisma;

      try {
        const {
          userId,
          organizationId,
        } = request.user;

        const user =
          await prisma.userAccount.findUnique(
            {
              where: {
                id: userId,
              },

              include: {
                organization: true,

                roles: {
                  include: {
                    role: true,
                  },
                },

                _count: {
                  select: {
                    assignedApplications:
                      true,
                  },
                },
              },
            },
          );

        if (
          !user ||
          user.organizationId !==
            organizationId
        ) {
          return reply
            .code(404)
            .send({
              ok: false,

              message:
                "User not found",
            });
        }

        return reply.send({
          ok: true,

          data: {
            user: {
              id: user.id,

              email:
                user.email,

              firstName:
                user.firstName,

              lastName:
                user.lastName,

              name:
                `${user.firstName || ""} ${
                  user.lastName || ""
                }`.trim(),

              phone:
                user.phone,

              profileImage:
                user.profileImage ||
                null,

              status:
                user.status,

              roles:
                user.roles.map(
                  (r) =>
                    r.role.name,
                ),

              assignedApplications:
                user._count
                  .assignedApplications,
            },

            organization: {
              id:
                user.organization.id,

              name:
                user.organization
                  .name,

              type:
                user.organization
                  .type,

              status:
                user.organization
                  .status,
            },
          },
        });
      } catch (err) {
        request.log.error(err);

        return reply
          .code(500)
          .send({
            ok: false,

            message:
              "Failed to fetch sub broker profile",
          });
      }
    },
  );
}

module.exports =
  subBrokerMeRoutes;