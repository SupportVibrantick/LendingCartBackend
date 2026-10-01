-- Document storage metadata + platform config for local/S3 switch
ALTER TABLE "application_document_uploads"
ADD COLUMN IF NOT EXISTS "storage_key" TEXT,
ADD COLUMN IF NOT EXISTS "storage_provider" TEXT;

CREATE TABLE IF NOT EXISTS "platform_config" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);
