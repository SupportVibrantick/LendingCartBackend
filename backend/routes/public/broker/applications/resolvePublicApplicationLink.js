const {
  resolvePublicApplicationLinkByToken,
} = require("../../../../services/applications/publicApplicationLink");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function resolvePublicApplicationLink(fastify) {
  fastify.get("/link", async (req, reply) => {
    const ref = String(req.query?.ref || req.query?.token || "").trim();

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

    return reply.send({
      success: true,
      data: {
        ref,
        brokerOrganizationId: resolved.brokerOrganizationId,
        brokerOrgId: resolved.brokerOrganizationId,
        brokerName: resolved.link.brokerOrganization?.name || null,
        brokerEmail: resolved.link.brokerOrganization?.email || null,
        sourcePortal: resolved.sourcePortal,
        createdByUserId: resolved.createdByUserId,
        loanOfficerId: resolved.loanOfficerId,
        coBrokerId: resolved.coBrokerId,
        showCoBrokerBorrowerInformationTab:
          resolved.showCoBrokerBorrowerInformationTab,
        expiresAt: resolved.link.expiresAt || null,
      },
    });
  });
};
