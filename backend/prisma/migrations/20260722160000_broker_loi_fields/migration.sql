-- Broker LOI fields on loan_applications
ALTER TABLE "loan_applications"
  ADD COLUMN IF NOT EXISTS "broker_loi_url" TEXT,
  ADD COLUMN IF NOT EXISTS "broker_loi_source_application_lender_id" UUID,
  ADD COLUMN IF NOT EXISTS "broker_loi_terms" JSONB,
  ADD COLUMN IF NOT EXISTS "broker_loi_generated_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "broker_loi_generated_by_user_id" UUID;
