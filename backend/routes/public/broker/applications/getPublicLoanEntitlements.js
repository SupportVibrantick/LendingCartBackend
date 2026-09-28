const {
  resolvePublicApplicationLinkByToken,
} = require("../../../../services/applications/publicApplicationLink");
const {
  getPublicLoanEntitlements,
} = require("../../../../utils/applications/publicLoanEntitlements");

/**
 * Public loan category/type entitlements for the embedded application form.
 * Accepts either ?ref= (share link) or ?brokerOrgId= (legacy).
 *
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getPublicLoanEntitlementsRoute(fastify) {
  fastify.get(
    "/entitlements",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const ref = String(req.query?.ref || "").trim();
      const brokerOrgIdParam = String(
        req.query?.brokerOrgId || req.query?.broker || "",
      ).trim();

      let organizationId = null;

      if (ref) {
        const resolved = await resolvePublicApplicationLinkByToken(
          fastify.prisma,
          ref,
        );
        if (!resolved.ok) {
          return reply.code(resolved.status).send({
            success: false,
            code: resolved.code,
            message: resolved.message,
          });
        }
        organizationId = resolved.brokerOrganizationId;
      } else if (brokerOrgIdParam) {
        const org = await fastify.prisma.organization.findFirst({
          where: { id: brokerOrgIdParam, type: "BROKER" },
          select: { id: true },
        });
        if (!org) {
          return reply.code(404).send({
            success: false,
            message: "Invalid broker organization",
          });
        }
        organizationId = org.id;
      } else {
        return reply.code(400).send({
          success: false,
          message: "Provide ref or brokerOrgId",
        });
      }

      const loanEntitlements = await getPublicLoanEntitlements(
        fastify.prisma,
        organizationId,
      );

      return reply.send({
        success: true,
        data: {
          brokerOrgId: organizationId,
          ...loanEntitlements,
        },
      });
    },
  );
};
