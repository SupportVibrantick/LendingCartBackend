const { refreshUsageSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const {
  ACTIVE_SUB_STATUSES,
  refreshUsageForSubscription,
} = require("../../../../services/subscription/subscriptionBilling");

async function refreshUsageRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Refresh subscription usage metrics",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = refreshUsageSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { organizationSubscriptionId, organizationId } = parsed.data;

        if (organizationSubscriptionId) {
          const records = await refreshUsageForSubscription(prisma, organizationSubscriptionId);
          return reply.send({
            success: true,
            message: "Usage refreshed",
            data: records,
          });
        }

        if (organizationId) {
          const sub = await prisma.organizationSubscription.findFirst({
            where: {
              organizationId,
              status: { in: ACTIVE_SUB_STATUSES },
            },
          });
          if (!sub) {
            return reply.status(404).send({
              success: false,
              message: "No active subscription found",
            });
          }
          const records = await refreshUsageForSubscription(prisma, sub.id);
          return reply.send({
            success: true,
            message: "Usage refreshed",
            data: records,
          });
        }

        const subs = await prisma.organizationSubscription.findMany({
          where: { status: { in: ACTIVE_SUB_STATUSES } },
          select: { id: true },
        });

        const allRecords = [];
        for (const sub of subs) {
          const records = await refreshUsageForSubscription(prisma, sub.id);
          allRecords.push(...records);
        }

        return reply.send({
          success: true,
          message: `Usage refreshed for ${subs.length} subscriptions`,
          data: allRecords,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to refresh usage",
        });
      }
    },
  );
}

module.exports = refreshUsageRoutes;
