const {
  resolvePublicBrokerOrgId,
} = require("../../../../utils/broker/resolvePublicBrokerOrgId");
const {
  fetchActiveBrokerApplication,
  formatActiveApplicationResponse,
} = require("../../../../utils/broker/activeBrokerApplication");
const {
  resolvePublicApplicationLinkByToken,
  SOURCE_PORTALS,
  shouldShowCoBrokerBorrowerInformationTab,
} = require("../../../../services/applications/publicApplicationLink");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getPublicActiveApplication(fastify) {
  fastify.get(
    "/active",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const ref = String(req.query?.ref || "").trim();

    let brokerOrgId = null;
    let sourcePortal = SOURCE_PORTALS.LEGACY;
    let showCoBrokerBorrowerInformationTab = false;
    let linkMeta = null;

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
      brokerOrgId = resolved.brokerOrganizationId;
      sourcePortal = resolved.sourcePortal;
      showCoBrokerBorrowerInformationTab =
        resolved.showCoBrokerBorrowerInformationTab;
      linkMeta = {
        createdByUserId: resolved.createdByUserId,
        loanOfficerId: resolved.loanOfficerId,
        coBrokerId: resolved.coBrokerId,
      };
    } else {
      brokerOrgId = await resolvePublicBrokerOrgId(fastify.prisma, req.query);
    }

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message:
          "Valid broker is required. Use ?ref=<token>, ?broker=<organizationId>, or ?brokerEmail=<email>.",
      });
    }

    const application = await fetchActiveBrokerApplication(
      fastify.prisma,
      brokerOrgId,
    );

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "No active loan application found for this broker",
        data: {
          brokerOrganizationId: brokerOrgId,
          sourcePortal,
          showCoBrokerBorrowerInformationTab:
            sourcePortal === SOURCE_PORTALS.LEGACY
              ? false
              : showCoBrokerBorrowerInformationTab,
          ...(linkMeta || {}),
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        ...formatActiveApplicationResponse(application),
        brokerOrganizationId: brokerOrgId,
        sourcePortal,
        showCoBrokerBorrowerInformationTab:
          sourcePortal === SOURCE_PORTALS.LEGACY
            ? false
            : shouldShowCoBrokerBorrowerInformationTab(sourcePortal),
        ...(linkMeta || {}),
      },
    });
  });
};
