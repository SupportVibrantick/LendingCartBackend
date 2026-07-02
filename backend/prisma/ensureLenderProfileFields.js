const prisma = require("./client");

/**
 * Adds extended lender profile text fields. Safe to run multiple times.
 */
async function ensureLenderProfileFields(existingPrisma) {
  const db = existingPrisma || prisma;

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "lendingCriteria" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "lendingGuidelines" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "creditRequirements" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "propertyRequirements" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "website" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "nmls" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "address" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "city" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "state" TEXT
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "lender_profiles"
    ADD COLUMN IF NOT EXISTS "zip" TEXT
  `);

  await db.$executeRawUnsafe(`
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
