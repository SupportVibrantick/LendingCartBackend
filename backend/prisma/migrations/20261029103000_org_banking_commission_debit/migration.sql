-- Principal broker / firm bank account used to fund commission ACH debits.
CREATE TABLE "organization_banking_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "accountType" "BankingAccountType" NOT NULL,
    "party_name" TEXT NOT NULL,
    "party_address" TEXT,
    "party_tel" TEXT,
    "party_email" TEXT,
    "bank_name" TEXT NOT NULL,
    "bank_tel" TEXT,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "aba_routing_number" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_payment_method_id" TEXT,
    "ach_debit_authorized_at" TIMESTAMPTZ(6),
    "ach_debit_authorized_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_banking_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_banking_profiles_organization_id_key"
  ON "organization_banking_profiles"("organization_id");

CREATE UNIQUE INDEX "organization_banking_profiles_stripe_customer_id_key"
  ON "organization_banking_profiles"("stripe_customer_id");

ALTER TABLE "organization_banking_profiles"
  ADD CONSTRAINT "organization_banking_profiles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ACH debit PaymentIntent id (principal broker bank → Stripe → recipient bank).
ALTER TABLE "commission_payouts"
  ADD COLUMN "stripe_payment_intent_id" TEXT;

CREATE UNIQUE INDEX "commission_payouts_stripe_payment_intent_id_key"
  ON "commission_payouts"("stripe_payment_intent_id");

-- Manual Zelle recording for outside-app bank transfers.
ALTER TYPE "CommissionPaymentMethod" ADD VALUE IF NOT EXISTS 'ZELLE';
