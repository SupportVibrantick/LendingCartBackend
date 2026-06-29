const {
  resolveCoBrokerBranding,
} = require("../../../utils/resolveCoBrokerBranding");

async function subBrokerBrandingRoute(fastify) {
  fastify.get(
    "/branding",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Sub Broker -> Auth"],
        summary: "Get co-broker portal branding",
      },
    },
    async (request, reply) => {
      try {
        const prisma = fastify.prisma;
        const { userId, organizationId } = request.user;

        const branding = await resolveCoBrokerBranding(
          prisma,
          userId,
          organizationId,
        );

        return reply.send({
          ok: true,
          data: branding,
        });
      } catch (err) {
        request.log.error(err);

        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch portal branding",
        });
      }
    },
  );
}

module.exports = subBrokerBrandingRoute;
