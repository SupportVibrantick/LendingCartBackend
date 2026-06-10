/**
 * Applies subscription billing DDL (subscription tables/columns only).
 * Usage: node prisma/applySubscriptionBillingMigration.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const statements = [
  `DO $$ BEGIN
    CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE "OrganizationSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'FAILED', 'VOID');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE "SubscriptionUsageMetric" AS ENUM ('LOAN_APPLICATIONS', 'ACTIVE_USERS', 'LOAN_OFFICERS', 'LENDER_CONNECTIONS');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `CREATE TABLE IF NOT EXISTS "subscription_packages" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceYearly" DECIMAL(10,2),
    "description" TEXT,
    "features" TEXT,
    "usageLimits" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_packages_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_packages_code_key" ON "subscription_packages"("code")`,

  `ALTER TABLE "subscription_packages"
    ADD COLUMN IF NOT EXISTS "priceYearly" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "usageLimits" JSONB,
    ADD COLUMN IF NOT EXISTS "isPopular" BOOLEAN NOT NULL DEFAULT false`,

  `CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "billingCycle" "SubscriptionBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "OrganizationSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMPTZ(6) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(6) NOT NULL,
    "trialEndsAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "assignedByAdminId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "subscription_usage" (
    "id" UUID NOT NULL,
    "organizationSubscriptionId" UUID NOT NULL,
    "metric" "SubscriptionUsageMetric" NOT NULL,
    "limitValue" INTEGER,
    "usedValue" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "subscription_invoices" (
    "id" UUID NOT NULL,
    "organizationSubscriptionId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "SubscriptionBillingCycle" NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "stripeInvoiceId" TEXT,
    "externalPaymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE INDEX IF NOT EXISTS "organization_subscriptions_organizationId_idx" ON "organization_subscriptions"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "organization_subscriptions_packageId_idx" ON "organization_subscriptions"("packageId")`,
  `CREATE INDEX IF NOT EXISTS "organization_subscriptions_status_idx" ON "organization_subscriptions"("status")`,
  `CREATE INDEX IF NOT EXISTS "subscription_usage_organizationSubscriptionId_idx" ON "subscription_usage"("organizationSubscriptionId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_usage_organizationSubscriptionId_metric_periodStart_key" ON "subscription_usage"("organizationSubscriptionId", "metric", "periodStart")`,
  `CREATE INDEX IF NOT EXISTS "subscription_invoices_organizationId_idx" ON "subscription_invoices"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "subscription_invoices_organizationSubscriptionId_idx" ON "subscription_invoices"("organizationSubscriptionId")`,
  `CREATE INDEX IF NOT EXISTS "subscription_invoices_status_idx" ON "subscription_invoices"("status")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_invoices_invoiceNumber_key" ON "subscription_invoices"("invoiceNumber")`,

  `ALTER TABLE "organization_subscriptions"
    ADD COLUMN IF NOT EXISTS "trialEndingReminderSentAt" TIMESTAMPTZ(6)`,

  `DO $$ BEGIN
    ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_organizationSubscriptionId_fkey"
      FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organizationSubscriptionId_fkey"
      FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function applySubscriptionBillingMigration(client = prisma) {
  for (const sql of statements) {
    await client.$executeRawUnsafe(sql);
  }
}

if (require.main === module) {
  console.log("Applying subscription billing migration...");
  applySubscriptionBillingMigration()
    .then(() => console.log("Migration applied successfully."))
    .catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { applySubscriptionBillingMigration };
