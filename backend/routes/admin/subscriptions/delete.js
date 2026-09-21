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

        const exists = await prisma.subscriptionPackage.findUnique({
          where: { id },
          select: { id: true, name: true, code: true },
        });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Subscription package not found",
          });
        }

        const [subscriberCount, checkoutCount] = await Promise.all([
          prisma.organizationSubscription.count({ where: { packageId: id } }),
          prisma.loanAiGhlCheckout.count({ where: { packageId: id } }),
        ]);

        if (subscriberCount > 0 || checkoutCount > 0) {
          const parts = [];
          if (subscriberCount > 0) {
            parts.push(
              `${subscriberCount} organization subscription${subscriberCount === 1 ? "" : "s"}`,
            );
          }
          if (checkoutCount > 0) {
            parts.push(
              `${checkoutCount} checkout record${checkoutCount === 1 ? "" : "s"}`,
            );
          }

          return reply.status(409).send({
            success: false,
            message: `Cannot delete "${exists.name}" — it is referenced by ${parts.join(" and ")}. Deactivate the package instead, or reassign/cancel those subscriptions first.`,
            details: {
              packageId: id,
              packageCode: exists.code,
              subscriberCount,
              checkoutCount,
            },
          });
        }

        await prisma.subscriptionPackage.delete({ where: { id } });

        adminLogs.info("Subscription package deleted", {
          id,
          code: exists.code,
        });

        return reply.send({
          success: true,
          message: "Subscription package deleted successfully",
        });
      } catch (error) {
        // Prisma FK violation if a new reference appeared between the count and delete
        if (error?.code === "P2003") {
          return reply.status(409).send({
            success: false,
            message:
              "Cannot delete this package because it is still referenced by subscribers or checkouts. Deactivate it instead.",
          });
        }

        adminLogs.error("Subscription package delete failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while deleting subscription package",
        });
      }
    },
  );
}

module.exports = deleteSubscriptionPackageRoutes;
