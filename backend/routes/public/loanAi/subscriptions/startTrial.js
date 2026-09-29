const { loanAiPurchaseSchema } = require("../../../../schemas/public/loanAi/auth.schema");
const {
  LOAN_AI_CARD_TRIAL_NOTE,
  LOAN_AI_FREE_TRIAL_NOTE,
  getFreeTrialDays,
  isLoanAiFreeTrial,
  isLoanAiCardTrial,
} = require("../../../../services/subscription/freeTrial");
const { commonLogs } = require("../../../../services/logger/contextLogger");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");

/**
 * No-card start-trial is retired. Free trials now require a Stripe card via
 * POST /subscriptions/checkout with withFreeTrial: true.
 */
async function hasUsedLoanAiFreeTrial(prisma, loanAiUser) {
  const orFilters = [{ loanAiUserId: loanAiUser.id }];
  if (loanAiUser.brokerOrganizationId) {
    orFilters.push({ organizationId: loanAiUser.brokerOrganizationId });
  }

  const prior = await prisma.organizationSubscription.findFirst({
    where: {
      AND: [
        { OR: orFilters },
        {
          OR: [
            { notes: { contains: LOAN_AI_FREE_TRIAL_NOTE } },
            { notes: { contains: LOAN_AI_CARD_TRIAL_NOTE } },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(prior);
}

async function loanAiStartTrialRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: [fastify.verifyLoanAi],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many trial attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Public -> Loan AI Subscriptions"],
        summary:
          "Deprecated no-card trial — use checkout with withFreeTrial (card required)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const user = req.loanAiUser;
      const ip = getClientIp(req);

      try {
        const ipLimit = await checkRateLimit(`loan-ai-start-trial:ip:${ip}`, {
          windowMs: 15 * 60 * 1000,
          max: 20,
        });
        if (!ipLimit.allowed) {
          return reply.status(429).send({
            success: false,
            code: "RATE_LIMITED",
            message: "Too many trial attempts. Please try again later.",
            retryAfterSec: ipLimit.retryAfterSec,
          });
        }

        // Soft-validate body so clients get familiar errors; trial itself is card-checkout only.
        loanAiPurchaseSchema.safeParse(req.body || {});

        if (await hasUsedLoanAiFreeTrial(prisma, user)) {
          return reply.status(409).send({
            success: false,
            code: "TRIAL_ALREADY_USED",
            message:
              "You have already used your free trial. Choose a plan to subscribe.",
          });
        }

        if (user.brokerOrganizationId) {
          const activeSub = await prisma.organizationSubscription.findFirst({
            where: {
              organizationId: user.brokerOrganizationId,
              status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
            },
            select: { id: true, status: true, notes: true },
          });
          if (activeSub) {
            return reply.status(409).send({
              success: false,
              code: "SUBSCRIPTION_ACTIVE",
              message:
                isLoanAiFreeTrial(activeSub) || isLoanAiCardTrial(activeSub)
                  ? "You already have an active free trial."
                  : "You already have an active broker subscription.",
            });
          }
        }

        const trialDays = getFreeTrialDays();
        return reply.status(400).send({
          success: false,
          code: "CARD_REQUIRED",
          message: `A payment card is required to start your ${trialDays}-day free trial. Use subscription checkout with withFreeTrial enabled — you will not be charged until day ${trialDays + 1}.`,
          data: {
            trialDays,
            useCheckout: true,
            withFreeTrial: true,
          },
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            code: error.code || "TRIAL_FAILED",
            message: error.message,
          });
        }

        commonLogs.error("Loan AI free trial gate failed", error);
        return reply.status(500).send({
          success: false,
          code: "TRIAL_FAILED",
          message: error.message || "Failed to start free trial",
        });
      }
    },
  );
}

module.exports = loanAiStartTrialRoutes;
