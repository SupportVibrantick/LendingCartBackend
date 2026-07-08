const { assertBrokerSubscriptionAccess } = require("../services/subscription/subscriptionBilling");

/**
 * Blocks broker API access when subscription is PAST_DUE, CANCELLED, or EXPIRED.
 * Brokers with no subscription record are allowed (legacy orgs).
 */
module.exports = async function verifyBrokerSubscription(fastify) {
  fastify.addHook("preHandler", async (req, reply) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return;

    const access = await assertBrokerSubscriptionAccess(fastify.prisma, organizationId);

    if (!access.allowed) {
      return reply.code(402).send({
        success: false,
        code: access.code,
        message: access.message,
        subscriptionStatus: access.subscription?.status,
      });
    }
  });
};
