const { adminLogs } = require("../../../../services/logger/contextLogger");
const { changePlanSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const { changePlan } = require("../../../../services/subscription/subscriptionBilling");

async function changePlanRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Change broker subscription plan",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = changePlanSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const result = await changePlan(prisma, {
          ...parsed.data,
          assignedByAdminId: req.user?.id || null,
        });

        adminLogs.info("Subscription plan changed", {
          organizationId: parsed.data.organizationId,
          packageId: parsed.data.packageId,
        });

        return reply.send({
          success: true,
          message: "Subscription plan updated successfully",
          data: result,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }
        adminLogs.error("Change plan failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to change subscription plan",
        });
      }
    },
  );
}

module.exports = changePlanRoutes;
