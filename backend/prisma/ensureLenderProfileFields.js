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

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "website" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "nmls" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "address" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "city" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "state" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "zip" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "lenderType" TEXT
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
