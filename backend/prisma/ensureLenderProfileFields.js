const prisma = require("./client");

/**
 * Adds extended lender profile text fields. Safe to run multiple times.
 */
async function ensureLenderProfileFields() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "lendingCriteria" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "lendingGuidelines" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "creditRequirements" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "propertyRequirements" TEXT
  `);
}

module.exports = { ensureLenderProfileFields };

if (require.main === module) {
  ensureLenderProfileFields()
    .then(() => {
      console.log("✅ Lender profile fields are ready");
    })
    .catch((error) => {
      console.error("❌ Failed to prepare lender profile fields:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
