const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  updateSubscriptionPackageSchema,
} = require("../../../schemas/admin/subscriptions/update.schema");
const { ensureSinglePopularPackage } = require("../../../services/subscriptionBilling");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateSubscriptionPackageRoutes(fastify) {
  fastify.put(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Update Subscription Package",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = updateSubscriptionPackageSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const {
          id,
          name,
          code,
          priceMonthly,
          priceYearly,
          description,
          features,
          usageLimits,
          sortOrder,
          isPopular,
        } = parsed.data;

        const exists = await prisma.subscriptionPackage.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Subscription package not found",
          });
        }

        const codeConflict = await prisma.subscriptionPackage.findFirst({
          where: {
            code,
            NOT: { id },
          },
        });

        if (codeConflict) {
          return reply.status(409).send({
            success: false,
            message: "Subscription package with this code already exists",
          });
        }

        const updated = await prisma.subscriptionPackage.update({
          where: { id },
          data: {
            name,
            code,
            priceMonthly,
            priceYearly: priceYearly ?? null,
            description: description ?? null,
            features: features ?? null,
            usageLimits: usageLimits ?? null,
            ...(typeof sortOrder !== "undefined" ? { sortOrder } : {}),
            ...(typeof isPopular !== "undefined" ? { isPopular } : {}),
          },
        });

        if (updated.isPopular) {
          await ensureSinglePopularPackage(prisma, updated.id);
        }

        adminLogs.info("Subscription package updated", { id });

        return reply.send({
          success: true,
          message: "Subscription package updated successfully",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("Subscription package update failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating subscription package",
        });
      }
    }
  );
}

module.exports = updateSubscriptionPackageRoutes;
