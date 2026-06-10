const { adminLogs } = require("../../../../services/logger/contextLogger");
const { cancelSubscriptionSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const { cancelSubscription } = require("../../../../services/subscriptionBilling");

async function cancelSubscriberRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Cancel broker subscription",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = cancelSubscriptionSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const subscription = await cancelSubscription(prisma, parsed.data);

        adminLogs.info("Subscription cancelled", {
          organizationId: parsed.data.organizationId,
          immediate: parsed.data.immediate,
        });

        return reply.send({
          success: true,
          message: parsed.data.immediate
            ? "Subscription cancelled immediately"
            : "Subscription will cancel at period end",
          data: subscription,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }
        adminLogs.error("Cancel subscription failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to cancel subscription",
        });
      }
    },
  );
}

module.exports = cancelSubscriberRoutes;
