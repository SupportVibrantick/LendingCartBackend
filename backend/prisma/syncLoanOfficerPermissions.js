/**
 * Sync loan officer permission keys from catalog (insert missing only).
 * Safe to run on every deploy — does not remove or overwrite existing permissions.
 */
const prisma = require("./client");
const {
  seedLoanOfficerPermissions,
} = require("./broker/loanOfficerPermissions.seed");

async function main() {
  console.log("🔐 Syncing loan officer permissions from catalog...");
  await seedLoanOfficerPermissions();
}

main()
  .catch((error) => {
    console.error("❌ Loan officer permissions sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
