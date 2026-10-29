ALTER TABLE "user_banking_profiles"
  ADD COLUMN "stripe_connected_account_id" TEXT,
  ADD COLUMN "stripe_external_account_id" TEXT;

CREATE UNIQUE INDEX "user_banking_profiles_stripe_connected_account_id_key"
  ON "user_banking_profiles"("stripe_connected_account_id");

ALTER TABLE "commission_payouts"
  ADD COLUMN "stripe_transfer_id" TEXT,
  ADD COLUMN "stripe_payout_id" TEXT,
  ADD COLUMN "stripe_reversal_id" TEXT,
  ADD COLUMN "failure_reason" TEXT;

CREATE UNIQUE INDEX "commission_payouts_stripe_transfer_id_key"
  ON "commission_payouts"("stripe_transfer_id");

CREATE UNIQUE INDEX "commission_payouts_stripe_payout_id_key"
  ON "commission_payouts"("stripe_payout_id");

CREATE UNIQUE INDEX "commission_payouts_one_processing_per_commission"
  ON "commission_payouts"("deal_commission_id")
  WHERE "status" = 'PROCESSING';
