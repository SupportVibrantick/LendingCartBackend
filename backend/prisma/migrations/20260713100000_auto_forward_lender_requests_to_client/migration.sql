-- Auto-forward lender document requests to client (broker gate)
ALTER TABLE "loan_applications"
ADD COLUMN IF NOT EXISTS "auto_forward_lender_requests_to_client" BOOLEAN NOT NULL DEFAULT false;

-- Preserve visibility for existing lender-requested upload docs already shown to clients
UPDATE "application_document_requirements"
SET "sent_to_client_at" = COALESCE("sent_to_client_at", "lastRequestedAt", "createdAt")
WHERE "source" = 'LENDER_ADDED'
  AND "requires_client_signature" = false
  AND "sent_to_client_at" IS NULL;
