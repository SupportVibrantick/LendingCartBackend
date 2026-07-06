/**
 * Idempotent SQL patches for columns/tables not yet covered by prisma migrate deploy.
 * Safe to run on every deploy before seed.
 *
 * Usage: node prisma/applySchemaPatches.js
 */
const { PrismaClient } = require("@prisma/client");
const {
  applySubscriptionBillingMigration,
} = require("./applySubscriptionBillingMigration");
const {
  applyPasswordResetTokenMigration,
} = require("./applyPasswordResetTokenMigration");
const { applyLoanAiUserMigration } = require("./applyLoanAiUserMigration");
const {
  applyLenderProductCriteriaMigration,
} = require("./applyLenderProductCriteriaMigration");
const { ensureLenderProfileFields } = require("./ensureLenderProfileFields");
const { ensureEmailOutbox } = require("./ensureEmailOutbox");
const { ensureSchedulerJobLocks } = require("./ensureSchedulerJobLocks");

const ENUM_PATCHES = [
  `DO $$ BEGIN
    ALTER TYPE "RoleName" ADD VALUE 'LENDER_ANALYST';
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  `DO $$ BEGIN
    ALTER TYPE "RoleName" ADD VALUE 'LENDER_VIEWER';
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,
];

const COLUMN_PATCHES = [
  `ALTER TABLE "loan_applications"
    ADD COLUMN IF NOT EXISTS "auto_forward_documents_to_lender" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "loan_applications"
    DROP COLUMN IF EXISTS "amount_requested"`,

  `ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false`,

  `ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6)`,

  // Fee Agreement branding fields
  `ALTER TABLE "fee_agreements"
    ADD COLUMN IF NOT EXISTS "brokerLogoUrl" TEXT`,

  `ALTER TABLE "fee_agreements"
    ADD COLUMN IF NOT EXISTS "brokerBrandName" TEXT`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "requires_client_signature" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "sign_document_title" TEXT`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "template_file_name" TEXT`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "template_file_url" TEXT`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "template_mime_type" TEXT`,

  `DO $$ BEGIN
    CREATE TYPE "SignDocumentStatus" AS ENUM (
      'AWAITING_BROKER',
      'SENT_TO_CLIENT',
      'CLIENT_SIGNED',
      'FORWARDED_TO_LENDER'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "sign_status" "SignDocumentStatus"`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "sent_to_client_at" TIMESTAMPTZ(6)`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "client_signed_at" TIMESTAMPTZ(6)`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "lender_seen_at" TIMESTAMPTZ(6)`,

  `DO $$ BEGIN
    ALTER TYPE "SignDocumentStatus" ADD VALUE 'LENDER_SEEN';
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,

  `ALTER TABLE "application_document_requirements"
    ADD COLUMN IF NOT EXISTS "request_application_lender_id" UUID`,

  `ALTER TABLE "application_document_uploads"
    ADD COLUMN IF NOT EXISTS "is_signed_output" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "application_document_uploads"
    ADD COLUMN IF NOT EXISTS "client_signature_data" TEXT`,

  `ALTER TABLE "broker_user_profiles"
    ADD COLUMN IF NOT EXISTS "w9Url" TEXT`,

  `ALTER TABLE "broker_user_profiles"
    ADD COLUMN IF NOT EXISTS "profileData" JSONB`,
];

async function applySchemaPatches(existingPrisma) {
  const prisma = existingPrisma || new PrismaClient();
  const shouldDisconnect = !existingPrisma;

  console.log("🔧 Applying schema patches...");

  for (const sql of ENUM_PATCHES) {
    await prisma.$executeRawUnsafe(sql);
  }

  const lenderTeamRoles = ["LENDER_ANALYST", "LENDER_VIEWER"];
  for (const roleName of lenderTeamRoles) {
    const existingRole = await prisma.role.findFirst({
      where: { name: roleName },
    });

    if (!existingRole) {
      await prisma.role.create({
        data: {
          name: roleName,
          description: roleName.replaceAll("_", " "),
        },
      });
    }
  }

  for (const sql of COLUMN_PATCHES) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log("✅ Column patches applied");

  await applySubscriptionBillingMigration(prisma);
  await applyPasswordResetTokenMigration();
  await applyLoanAiUserMigration();
  await applyLenderProductCriteriaMigration(prisma);
  await ensureLenderProfileFields(prisma);
  await ensureEmailOutbox(prisma);
  await ensureSchedulerJobLocks(prisma);
  console.log("✅ Lender profile columns patched");

  console.log("✅ All schema patches completed");

  if (shouldDisconnect) {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  applySchemaPatches().catch((err) => {
    console.error("❌ Schema patch failed:", err);
    process.exit(1);
  });
}

module.exports = { applySchemaPatches };
