const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  createSubscriptionPackageSchema,
} = require("../../../schemas/admin/subscriptions/create.schema");
const { ensureSinglePopularPackage } = require("../../../services/subscription/subscriptionBilling");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createSubscriptionPackageRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Create Subscription Package",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = createSubscriptionPackageSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input data",
            details: parsed.error.issues,
          });
        }

        const {
          name,
          code,
          priceMonthly,
          priceYearly,
          description,
          features,
          usageLimits,
          sortOrder,
          isActive,
          isPopular,
        } = parsed.data;

        const existing = await prisma.subscriptionPackage.findFirst({
          where: { code },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            message: "Subscription package with this code already exists",
          });
        }

        const subscriptionPackage = await prisma.subscriptionPackage.create({
          data: {
            name,
            code,
            priceMonthly,
            priceYearly: priceYearly ?? null,
            description: description ?? null,
            features: features ?? null,
            usageLimits: usageLimits ?? null,
            sortOrder: sortOrder ?? 0,
            isActive: isActive ?? true,
            isPopular: isPopular ?? false,
          },
        });

        if (subscriptionPackage.isPopular) {
          await ensureSinglePopularPackage(prisma, subscriptionPackage.id);
        }

        adminLogs.info("Subscription package created", {
          subscriptionPackageId: subscriptionPackage.id,
          code: subscriptionPackage.code,
        });

        return reply.status(201).send({
          success: true,
          message: "Subscription package created successfully",
          data: subscriptionPackage,
        });
      } catch (error) {
        adminLogs.error("Subscription package create failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while creating subscription package",
        });
      }
    }
  );
}

module.exports = createSubscriptionPackageRoutes;
