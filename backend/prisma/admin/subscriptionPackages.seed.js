const prisma = require("../client");
const {
  SUBSCRIPTION_PACKAGES,
  packageToSeedData,
} = require("./subscriptionPackageCatalog");

async function seedSubscriptionPackages() {
  for (const pkg of SUBSCRIPTION_PACKAGES) {
    const data = packageToSeedData(pkg);

    await prisma.subscriptionPackage.upsert({
      where: { code: pkg.code },
      update: {
        name: data.name,
        priceMonthly: data.priceMonthly,
        priceYearly: data.priceYearly,
        description: data.description,
        features: data.features,
        usageLimits: data.usageLimits,
        sortOrder: data.sortOrder,
        isPopular: data.isPopular,
      },
      create: data,
    });

    console.log(`✅ Synced subscription package: ${pkg.name} ($${pkg.priceMonthly}/month)`);
  }

  console.log("🎉 Subscription packages seeded successfully");
}

module.exports = {
  seedSubscriptionPackages,
};
