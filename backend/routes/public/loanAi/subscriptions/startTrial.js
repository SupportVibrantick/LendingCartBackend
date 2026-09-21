const { loanAiPurchaseSchema } = require("../../../../schemas/public/loanAi/auth.schema");
const { provisionBrokerFromLoanAi } = require("../../../../services/broker/provisionBrokerFromLoanAi");
const {
  LOAN_AI_FREE_TRIAL_NOTE,
  getFreeTrialDays,
  isLoanAiFreeTrial,
} = require("../../../../services/subscription/freeTrial");
const { commonLogs } = require("../../../../services/logger/contextLogger");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");

async function hasUsedLoanAiFreeTrial(prisma, loanAiUser) {
  const orFilters = [{ loanAiUserId: loanAiUser.id }];
  if (loanAiUser.brokerOrganizationId) {
    orFilters.push({ organizationId: loanAiUser.brokerOrganizationId });
  }

  const prior = await prisma.organizationSubscription.findFirst({
    where: {
      OR: orFilters,
      notes: { contains: LOAN_AI_FREE_TRIAL_NOTE },
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
        summary: "Start a no-card Loan AI free trial and provision broker access",
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

        const parsed = loanAiPurchaseSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            code: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message || "Invalid trial data",
          });
        }

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
              message: isLoanAiFreeTrial(activeSub)
                ? "You already have an active free trial."
                : "You already have an active broker subscription.",
            });
          }
        }

        const pkg = await prisma.subscriptionPackage.findFirst({
          where: { id: parsed.data.packageId, isActive: true },
        });

        if (!pkg) {
          return reply.status(404).send({
            success: false,
            code: "INVALID_PACKAGE",
            message: "Subscription package not found or inactive",
          });
        }

        const trialDays = getFreeTrialDays();

        const result = await provisionBrokerFromLoanAi(
          prisma,
          fastify.io,
          user,
          {
            ...parsed.data,
            // Trial is plan-only; add-ons are selected at paid conversion.
            addOnCodes: [],
            trialDays,
            generateInvoice: false,
            notes: LOAN_AI_FREE_TRIAL_NOTE,
            notificationSource: "LOAN_AI_FREE_TRIAL",
          },
        );

        return reply.status(201).send({
          success: true,
          message:
            "Free trial started. Broker dashboard credentials have been sent to your email.",
          data: {
            ...result,
            trialDays,
            packageId: pkg.id,
            packageCode: pkg.code,
            packageName: pkg.name,
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

        commonLogs.error("Loan AI free trial failed", error);
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
