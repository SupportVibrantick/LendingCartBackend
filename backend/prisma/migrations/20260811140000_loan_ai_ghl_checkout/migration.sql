-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LoanAiGhlCheckoutStatus" AS ENUM (
    'PENDING',
    'CHECKOUT_CREATED',
    'PAID',
    'FAILED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "loan_ai_ghl_checkouts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "loanAiUserId" UUID NOT NULL,
  "packageId" UUID NOT NULL,
  "billingCycle" "SubscriptionBillingCycle" NOT NULL,
  "status" "LoanAiGhlCheckoutStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "ghlContactId" TEXT,
  "ghlProductId" TEXT,
  "ghlPriceId" TEXT NOT NULL,
  "ghlInvoiceId" TEXT,
  "checkoutUrl" TEXT,
  "successUrl" TEXT,
  "cancelUrl" TEXT,
  "lastError" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_ai_ghl_checkouts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "loan_ai_ghl_checkouts"
    ADD CONSTRAINT "loan_ai_ghl_checkouts_loanAiUserId_fkey"
    FOREIGN KEY ("loanAiUserId") REFERENCES "loan_ai_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loan_ai_ghl_checkouts"
    ADD CONSTRAINT "loan_ai_ghl_checkouts_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_loanAiUserId_idx"
  ON "loan_ai_ghl_checkouts"("loanAiUserId");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_packageId_idx"
  ON "loan_ai_ghl_checkouts"("packageId");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_status_idx"
  ON "loan_ai_ghl_checkouts"("status");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlInvoiceId_idx"
  ON "loan_ai_ghl_checkouts"("ghlInvoiceId");
CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlContactId_idx"
  ON "loan_ai_ghl_checkouts"("ghlContactId");
