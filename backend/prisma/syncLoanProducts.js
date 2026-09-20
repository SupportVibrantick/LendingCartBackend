/**
 * Sync loan products from loanProductCatalog.js (upsert by code).
 * Safe to run on every deploy — creates/updates catalog products and
 * deactivates codes no longer in the catalog.
 */
const prisma = require("./client");
const { seedLoanProducts } = require("./admin/loanProduct.seed");

async function main() {
  console.log("📦 Syncing loan products from catalog...");
  await seedLoanProducts();
}

main()
  .catch((error) => {
    console.error("❌ Loan product catalog sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
