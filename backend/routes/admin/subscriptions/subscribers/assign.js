const { adminLogs } = require("../../../../services/logger/contextLogger");
const { assignSubscriptionSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const { assignPlanToOrganization } = require("../../../../services/subscriptionBilling");

async function assignSubscriberRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Assign subscription plan to broker",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = assignSubscriptionSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const result = await assignPlanToOrganization(prisma, {
          ...parsed.data,
          assignedByAdminId: req.user?.id || null,
        });

        adminLogs.info("Subscription assigned", {
          organizationId: parsed.data.organizationId,
          packageId: parsed.data.packageId,
        });

        return reply.status(201).send({
          success: true,
          message: "Subscription assigned successfully",
          data: result,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }
        adminLogs.error("Subscription assign failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to assign subscription",
        });
      }
    },
  );
}

module.exports = assignSubscriberRoutes;
