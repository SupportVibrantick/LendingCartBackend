/**
 * Idempotent SQL patches for columns/tables not yet covered by prisma migrate deploy.
 * Safe to run on every deploy before seed.
 *
 * Usage: node prisma/applySchemaPatches.js
 */
const { PrismaClient } = require("@prisma/client");
const { applySubscriptionBillingMigration } = require("./applySubscriptionBillingMigration");
const { applyPasswordResetTokenMigration } = require("./applyPasswordResetTokenMigration");
const { applyLoanAiUserMigration } = require("./applyLoanAiUserMigration");

const COLUMN_PATCHES = [
  `ALTER TABLE "loan_applications"
    ADD COLUMN IF NOT EXISTS "auto_forward_documents_to_lender" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "loan_applications"
    ADD COLUMN IF NOT EXISTS "amount_requested" DECIMAL(20,2)`,

  `ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false`,

  `ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6)`,

  // Fee Agreement branding fields
  `ALTER TABLE "fee_agreements"
    ADD COLUMN IF NOT EXISTS "brokerLogoUrl" TEXT`,

  `ALTER TABLE "fee_agreements"
    ADD COLUMN IF NOT EXISTS "brokerBrandName" TEXT`,
];

async function applySchemaPatches(existingPrisma) {
  const prisma = existingPrisma || new PrismaClient();
  const shouldDisconnect = !existingPrisma;

  console.log("🔧 Applying schema patches...");

  for (const sql of COLUMN_PATCHES) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log("✅ Column patches applied");

  await applySubscriptionBillingMigration(prisma);
  await applyPasswordResetTokenMigration();
  await applyLoanAiUserMigration();

  console.log("✅ All schema patches completed");

  if (shouldDisconnect) {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  applySchemaPatches()
    .catch((err) => {
      console.error("❌ Schema patch failed:", err);
      process.exit(1);
    });
}

module.exports = { applySchemaPatches };
