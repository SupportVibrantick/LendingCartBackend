const {
  formatOrgBanking,
  getOrganizationBanking,
} = require("../../../services/broker/organizationBanking.service");
const { isCommissionAchEnabled } = require("../../../services/stripe/commissionAchPayout.service");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getOrgBankingRoute(fastify) {
  fastify.get(
    "/banking",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Get principal broker / firm bank details for commission ACH funding",
      },
    },
    async (req, reply) => {
      if (!req.user?.organizationId) {
        return reply.code(403).send({ success: false, message: "Broker access only" });
      }
      if (!(req.user.roles || []).includes("BROKER_ADMIN")) {
        return reply.code(403).send({
          success: false,
          message: "Only broker admins can view firm banking details",
        });
      }

      const profile = await getOrganizationBanking(
        fastify.prisma,
        req.user.organizationId,
      );

      return reply.send({
        success: true,
        data: {
          banking: formatOrgBanking(profile),
          achTransfersEnabled: isCommissionAchEnabled(),
        },
      });
    },
  );
};
