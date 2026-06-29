ALTER TABLE "application_document_requirements"
ADD COLUMN IF NOT EXISTS "requested_by_sub_broker_id" UUID;

ALTER TABLE "application_document_requirements"
ADD CONSTRAINT "application_document_requirements_requested_by_sub_broker_id_fkey"
FOREIGN KEY ("requested_by_sub_broker_id") REFERENCES "user_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "application_document_requirements_requested_by_sub_broker_id_idx"
ON "application_document_requirements"("requested_by_sub_broker_id");
