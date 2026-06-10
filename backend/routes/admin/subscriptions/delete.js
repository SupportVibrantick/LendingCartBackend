const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  deleteSubscriptionPackageSchema,
} = require("../../../schemas/admin/subscriptions/delete.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteSubscriptionPackageRoutes(fastify) {
  fastify.delete(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Delete Subscription Package",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = deleteSubscriptionPackageSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id } = parsed.data;

        const exists = await prisma.subscriptionPackage.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Subscription package not found",
          });
        }

        await prisma.subscriptionPackage.delete({ where: { id } });

        adminLogs.info("Subscription package deleted", { id });

        return reply.send({
          success: true,
          message: "Subscription package deleted successfully",
        });
      } catch (error) {
        adminLogs.error("Subscription package delete failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while deleting subscription package",
        });
      }
    }
  );
}

module.exports = deleteSubscriptionPackageRoutes;
