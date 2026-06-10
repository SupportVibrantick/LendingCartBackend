const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  toggleSubscriptionPackageStatusSchema,
} = require("../../../schemas/admin/subscriptions/status.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleSubscriptionPackageStatusRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Enable / Disable Subscription Package",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = toggleSubscriptionPackageStatusSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id, isActive } = parsed.data;

        const exists = await prisma.subscriptionPackage.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Subscription package not found",
          });
        }

        const updated = await prisma.subscriptionPackage.update({
          where: { id },
          data: { isActive },
        });

        adminLogs.info("Subscription package status changed", {
          id,
          isActive,
        });

        return reply.send({
          success: true,
          message: "Subscription package status updated",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("Subscription package status toggle failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating status",
        });
      }
    }
  );
}

module.exports = toggleSubscriptionPackageStatusRoutes;
