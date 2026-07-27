/**
 * Sync subscription packages from catalog (upsert by code).
 * Safe to run on every deploy — does not touch other seed data.
 */
const prisma = require("./client");
const {
  seedSubscriptionPackages,
} = require("./admin/subscriptionPackages.seed");

async function main() {
  console.log("📦 Syncing subscription packages from catalog...");
  await seedSubscriptionPackages();
}

main()
  .catch((error) => {
    console.error("❌ Subscription package sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
