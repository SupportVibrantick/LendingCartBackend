const {
  resolveBrokerPortalBranding,
} = require("../../../utils/broker/resolveBrokerPortalBranding");

async function brokerBrandingRoute(fastify) {
  fastify.get(
    "/branding",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Get broker portal branding (logo + brand name)",
      },
    },
    async (request, reply) => {
      try {
        if (!request.user || request.user.orgType !== "BROKER") {
          return reply.code(403).send({
            ok: false,
            message: "Broker access only",
          });
        }

        const branding = await resolveBrokerPortalBranding(
          fastify.prisma,
          request.user.organizationId,
          "Broker Suite",
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

module.exports = brokerBrandingRoute;
