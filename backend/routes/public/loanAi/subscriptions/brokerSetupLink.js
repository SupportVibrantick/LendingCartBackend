const {
  createBrokerSetPasswordLink,
} = require("../../../../services/broker/createBrokerSetPasswordLink");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");

/**
 * POST /public/loan-ai/subscriptions/broker-setup-link
 * Authenticated Loan AI buyer → one-time broker set-password URL.
 */
async function loanAiBrokerSetupLinkRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: [fastify.verifyLoanAi],
      schema: {
        tags: ["Public -> Loan AI Subscriptions"],
        summary:
          "Create a one-time broker set-password link after purchase",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const user = req.loanAiUser;
      const ip = getClientIp(req);

      const userLimit = checkRateLimit(
        `loan-ai-broker-setup:user:${user.id}`,
        { windowMs: 60 * 1000, max: 8 },
      );
      if (!userLimit.allowed) {
        return reply.status(429).send({
          success: false,
          message: "Too many attempts. Please wait a moment and try again.",
          retryAfterSec: userLimit.retryAfterSec,
        });
      }

      const ipLimit = checkRateLimit(`loan-ai-broker-setup:ip:${ip}`, {
        windowMs: 60 * 1000,
        max: 20,
      });
      if (!ipLimit.allowed) {
        return reply.status(429).send({
          success: false,
          message: "Too many attempts. Please wait a moment and try again.",
          retryAfterSec: ipLimit.retryAfterSec,
        });
      }

      if (!user.brokerOrganizationId) {
        return reply.status(409).send({
          success: false,
          message:
            "Broker account is not ready yet. Wait a few seconds after payment and try again.",
        });
      }

      const sub = await prisma.organizationSubscription.findFirst({
        where: {
          organizationId: user.brokerOrganizationId,
          status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      });

      if (!sub) {
        return reply.status(409).send({
          success: false,
          message:
            "Subscription is not active yet. Confirm payment and try again.",
        });
      }

      try {
        const link = await createBrokerSetPasswordLink(prisma, {
          email: user.email,
        });

        return reply.send({
          success: true,
          data: {
            setPasswordUrl: link.setPasswordUrl,
            signInUrl: link.signInUrl,
            expiresAt: link.expiresAt,
            email: link.email,
          },
        });
      } catch (err) {
        const status = err.statusCode || 500;
        return reply.status(status).send({
          success: false,
          message:
            err.message ||
            "Could not create password setup link. Please try again.",
        });
      }
    },
  );
}

module.exports = loanAiBrokerSetupLinkRoutes;
