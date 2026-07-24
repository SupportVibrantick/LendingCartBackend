-- Persist normalized lender LOI terms when a lender generates an LOI PDF
ALTER TABLE "application_lenders"
  ADD COLUMN IF NOT EXISTS "loi_terms_json" JSONB;
