const prisma = require("../client");

async function seedSubscriptionPackages() {
  const packages = [
    {
      name: "Basic",
      code: "BASIC",
      priceMonthly: 199,
      priceYearly: 1990,
      description: "Essential tools for small broker teams getting started on the platform.",
      features: "Core loan pipeline, basic reporting, email support",
      usageLimits: { LOAN_APPLICATIONS: 50, ACTIVE_USERS: 10, LOAN_OFFICERS: 5, LENDER_CONNECTIONS: 10 },
      sortOrder: 1,
      isPopular: false,
    },
    {
      name: "Pro",
      code: "PRO",
      priceMonthly: 399,
      priceYearly: 3990,
      description: "Advanced features for growing brokerages that need more automation.",
      features: "Everything in Basic, lender discovery, advanced analytics, priority support",
      usageLimits: { LOAN_APPLICATIONS: 200, ACTIVE_USERS: 25, LOAN_OFFICERS: 15, LENDER_CONNECTIONS: 50 },
      sortOrder: 2,
      isPopular: true,
    },
    {
      name: "Elite",
      code: "ELITE",
      priceMonthly: 599,
      priceYearly: 5990,
      description: "Full platform access for high-volume teams and enterprise brokerages.",
      features: "Everything in Pro, white-label options, dedicated account manager, API access",
      usageLimits: { LOAN_APPLICATIONS: 1000, ACTIVE_USERS: 100, LOAN_OFFICERS: 50, LENDER_CONNECTIONS: 200 },
      sortOrder: 3,
      isPopular: false,
    },
  ];

  for (const pkg of packages) {
    const exists = await prisma.subscriptionPackage.findFirst({
      where: { code: pkg.code },
    });

    if (!exists) {
      await prisma.subscriptionPackage.create({
        data: {
          ...pkg,
          isActive: true,
        },
      });

      console.log(`✅ Created subscription package: ${pkg.name} ($${pkg.priceMonthly}/month)`);
    } else {
      console.log(`⚠️ Subscription package already exists: ${pkg.name}`);
    }
  }

  console.log("🎉 Subscription packages seeded successfully");
}

module.exports = {
  seedSubscriptionPackages,
};
