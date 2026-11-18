const prisma = require("./client");

let ensurePromise = null;

/**
 * Adds extended lender profile text fields. Safe to run multiple times.
 * Cached per process so request hot paths do not re-run ALTER TABLE.
 */
async function ensureLenderProfileFields(existingPrisma) {
  if (existingPrisma) {
    return runEnsure(existingPrisma);
  }

  if (!ensurePromise) {
    ensurePromise = runEnsure(prisma).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

async function runEnsure(db) {
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
