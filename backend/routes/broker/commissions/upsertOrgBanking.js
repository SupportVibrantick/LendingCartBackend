const {
  formatOrgBanking,
  upsertOrganizationBanking,
  requireBankingFromFields,
} = require("../../../services/broker/organizationBanking.service");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function upsertOrgBankingRoute(fastify) {
  fastify.put(
    "/banking",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Save principal broker / firm bank details used to fund commission ACH",
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    async (req, reply) => {
      if (!req.user?.organizationId) {
        return reply.code(403).send({ success: false, message: "Broker access only" });
      }
      if (!(req.user.roles || []).includes("BROKER_ADMIN")) {
        return reply.code(403).send({
          success: false,
          message: "Only broker admins can update firm banking details",
        });
      }

      const bankingResult = requireBankingFromFields(req.body || {});
      if (bankingResult.error) {
        return reply.code(400).send({
          success: false,
          message: bankingResult.error,
        });
      }

      const authorizeAchDebit = req.body?.authorizeAchDebit !== false;
      if (!authorizeAchDebit) {
        return reply.code(400).send({
          success: false,
          message: "You must authorize ACH debit from this firm bank account to pay commissions",
        });
      }

      const profile = await upsertOrganizationBanking(fastify.prisma, {
        organizationId: req.user.organizationId,
        banking: bankingResult.banking,
        authorizedByUserId: req.user.id || req.user.userId,
        authorizeAchDebit: true,
      });

      return reply.send({
        success: true,
        message: "Firm bank account saved. ACH commissions will debit this account",
        data: {
          banking: formatOrgBanking(profile),
        },
      });
    },
  );
};
