const { getClientIp } = require("../../../utils/security/rateLimit");
const {
  submitCommissionAchPayout,
} = require("../../../services/stripe/commissionAchPayout.service");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function sendAchPayoutRoute(fastify) {
  fastify.post(
    "/:commissionId/payouts/ach",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Send a commission ACH to the recipient bank account on file",
        params: {
          type: "object",
          required: ["commissionId"],
          properties: {
            commissionId: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          properties: {
            amount: { type: "number" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user?.organizationId) {
        return reply.code(403).send({ success: false, message: "Broker access only" });
      }

      const roles = req.user.roles || [];
      if (!roles.includes("BROKER_ADMIN")) {
        return reply.code(403).send({
          success: false,
          message: "Only broker admins can send commission payouts",
        });
      }

      try {
        const result = await submitCommissionAchPayout(fastify.prisma, {
          dealCommissionId: String(req.params.commissionId || "").trim(),
          brokerOrgId: req.user.organizationId,
          paidByUserId: req.user.id || req.user.userId,
          amount: req.body?.amount ?? null,
          notes: req.body?.notes || null,
          requestIp: getClientIp(req),
        });

        return reply.send({
          success: true,
          message:
            "Bank transfer started. Your firm account is debited first, then the recipient bank is paid when ACH clears",
          data: result,
        });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        fastify.log.error({ error: error.message }, "Commission ACH payout failed");
        return reply.code(statusCode).send({
          success: false,
          message: error.message || "Failed to send bank payout",
        });
      }
    },
  );
};
