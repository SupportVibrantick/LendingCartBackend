function parseFeatures(features) {
  if (!features?.trim()) return [];
  if (features.includes("\n")) {
    return features
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return features
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPackage(pkg) {
  return {
    id: pkg.id,
    name: pkg.name,
    code: pkg.code,
    priceMonthly: Number(pkg.priceMonthly),
    priceYearly: pkg.priceYearly != null ? Number(pkg.priceYearly) : null,
    isPopular: Boolean(pkg.isPopular),
    description: pkg.description,
    features: parseFeatures(pkg.features),
    usageLimits: pkg.usageLimits ?? null,
    sortOrder: pkg.sortOrder,
  };
}

const { getCatalogAddOns } = require("../../../utils/subscription/addOnCatalog");

/**
 * Public API: List active subscription packages for marketing / pricing pages.
 */
async function listPublicSubscriptionPackages(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Common → Subscriptions"],
        summary: "Public list of active subscription packages",
      },
    },
    async (_req, reply) => {
      const prisma = fastify.prisma;

      try {
        const packages = await prisma.subscriptionPackage.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            code: true,
            priceMonthly: true,
            priceYearly: true,
            isPopular: true,
            description: true,
            features: true,
            usageLimits: true,
            sortOrder: true,
          },
        });

        return reply.send({
          success: true,
          data: packages.map(formatPackage),
          addOns: getCatalogAddOns(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch subscription packages",
        });
      }
    },
  );
}

module.exports = listPublicSubscriptionPackages;
