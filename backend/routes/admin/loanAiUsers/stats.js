const { ACTIVE_SUB_STATUSES } = require("../../../services/subscription/subscriptionBilling");

async function loanAiUserStatsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan AI Users"],
        summary: "Loan AI registration stats",
      },
    },
    async (_req, reply) => {
      const prisma = fastify.prisma;

      try {
        const [total, subscribed] = await Promise.all([
          prisma.loanAiUser.count(),
          prisma.loanAiUser.count({
            where: {
              brokerOrganizationId: { not: null },
              brokerOrganization: {
                organizationSubscriptions: {
                  some: { status: { in: ACTIVE_SUB_STATUSES } },
                },
              },
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: {
            total,
            subscribed,
            pending: total - subscribed,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch Loan AI user stats",
        });
      }
    },
  );
}

module.exports = loanAiUserStatsRoutes;
