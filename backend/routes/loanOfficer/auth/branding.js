const {
  resolveBrokerPortalBranding,
} = require("../../../utils/broker/resolveBrokerPortalBranding");

async function loanOfficerBrandingRoute(fastify) {
  fastify.get(
    "/branding",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Loan Officer -> Auth"],
        summary: "Get loan officer portal branding (logo + brand name)",
      },
    },
    async (request, reply) => {
      try {
        if (!request.user || request.user.orgType !== "BROKER") {
          return reply.code(403).send({
            ok: false,
            message: "Broker organization access only",
          });
        }

        const branding = await resolveBrokerPortalBranding(
          fastify.prisma,
          request.user.organizationId,
          "Loan Officer",
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

module.exports = loanOfficerBrandingRoute;
