const { loanAiPurchaseSchema } = require("../../../../schemas/public/loanAi/auth.schema");
const { provisionBrokerFromLoanAi } = require("../../../../services/broker/provisionBrokerFromLoanAi");
const { commonLogs } = require("../../../../services/logger/contextLogger");

async function loanAiPurchaseRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: [fastify.verifyLoanAi],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many purchase attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Public -> Loan AI Subscriptions"],
        summary: "Complete subscription purchase (payment placeholder — provisions broker account)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = loanAiPurchaseSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: parsed.error.issues[0]?.message || "Invalid purchase data",
          });
        }

        const pkg = await prisma.subscriptionPackage.findFirst({
          where: { id: parsed.data.packageId, isActive: true },
        });

        if (!pkg) {
          return reply.status(404).send({
            success: false,
            message: "Subscription package not found or inactive",
          });
        }

        const result = await provisionBrokerFromLoanAi(
          prisma,
          fastify.io,
          req.loanAiUser,
          parsed.data,
        );

        return reply.status(201).send({
          success: true,
          message:
            "Subscription activated. Broker dashboard credentials have been sent to your email.",
          data: result,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        commonLogs.error("Loan AI purchase failed", error);
        return reply.status(500).send({
          success: false,
          message: error.message || "Failed to complete subscription",
        });
      }
    },
  );
}

module.exports = loanAiPurchaseRoutes;
