// backend/routes/broker/auth/me.js

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerMeRoutes(fastify) {
  fastify.get(
    "/me",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Get logged-in broker profile",
      },
    },
    async (req, reply) => {
      const user = req.user;

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles,
          },
          organization: {
            id: user.organizationId,
            type: user.orgType,
          },
        },
      });
    }
  );
}

module.exports = brokerMeRoutes;
