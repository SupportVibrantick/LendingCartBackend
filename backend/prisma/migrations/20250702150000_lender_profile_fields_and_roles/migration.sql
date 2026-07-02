-- RoleName enum values (also patched at seed via applySchemaPatches)
DO $$ BEGIN
  ALTER TYPE "RoleName" ADD VALUE 'LENDER_ANALYST';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "RoleName" ADD VALUE 'LENDER_VIEWER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Lender profile extended fields (schema.prisma LenderProfile model)
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "lendingCriteria" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "lendingGuidelines" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "creditRequirements" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "propertyRequirements" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "nmls" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "zip" TEXT;
ALTER TABLE "lender_profiles" ADD COLUMN IF NOT EXISTS "lenderType" TEXT;

-- Align subscription_usage unique index name with schema.prisma @@unique map
DROP INDEX IF EXISTS "subscription_usage_organizationSubscriptionId_metric_period_key";
DROP INDEX IF EXISTS "subscription_usage_organizationSubscriptionId_metric_periodStart_key";
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_usage_organizationSubscriptionId_metric_periodStar"
  ON "subscription_usage"("organizationSubscriptionId", "metric", "periodStart");
