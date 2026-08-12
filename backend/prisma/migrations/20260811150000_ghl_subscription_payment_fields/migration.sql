-- Extend OrganizationSubscriptionStatus
DO $$ BEGIN
  ALTER TYPE "OrganizationSubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "OrganizationSubscriptionStatus" ADD VALUE IF NOT EXISTS 'FAILED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- GHL payment status for checkout sessions
DO $$ BEGIN
  CREATE TYPE "GhlPaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- OrganizationSubscription GHL + Loan AI linkage
ALTER TABLE "organization_subscriptions"
  ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlPriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "loanAiUserId" UUID;

DO $$ BEGIN
  ALTER TABLE "organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_loanAiUserId_fkey"
    FOREIGN KEY ("loanAiUserId") REFERENCES "loan_ai_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "organization_subscriptions_loanAiUserId_idx"
  ON "organization_subscriptions"("loanAiUserId");
CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlContactId_idx"
  ON "organization_subscriptions"("ghlContactId");
CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlSubscriptionId_idx"
  ON "organization_subscriptions"("ghlSubscriptionId");
CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlPriceId_idx"
  ON "organization_subscriptions"("ghlPriceId");

-- SubscriptionInvoice GHL refs
ALTER TABLE "subscription_invoices"
  ADD COLUMN IF NOT EXISTS "ghlInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlTransactionId" TEXT;

CREATE INDEX IF NOT EXISTS "subscription_invoices_ghlInvoiceId_idx"
  ON "subscription_invoices"("ghlInvoiceId");
CREATE INDEX IF NOT EXISTS "subscription_invoices_ghlSubscriptionId_idx"
  ON "subscription_invoices"("ghlSubscriptionId");

-- LoanAiGhlCheckout extensions
ALTER TABLE "loan_ai_ghl_checkouts"
  ADD COLUMN IF NOT EXISTS "paymentStatus" "GhlPaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "organizationSubscriptionId" UUID;

DO $$ BEGIN
  ALTER TABLE "loan_ai_ghl_checkouts"
    ADD CONSTRAINT "loan_ai_ghl_checkouts_organizationSubscriptionId_fkey"
    FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_organizationSubscriptionId_key"
  ON "loan_ai_ghl_checkouts"("organizationSubscriptionId");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_paymentStatus_idx"
  ON "loan_ai_ghl_checkouts"("paymentStatus");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlSubscriptionId_idx"
  ON "loan_ai_ghl_checkouts"("ghlSubscriptionId");
