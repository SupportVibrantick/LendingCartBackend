ALTER TABLE "application_lenders"
ADD COLUMN IF NOT EXISTS "loi_sent_to_broker_at" TIMESTAMPTZ(6);

UPDATE "application_lenders"
SET "loi_sent_to_broker_at" = COALESCE("lastUpdatedAt", "sentAt", NOW())
WHERE "loiUrl" IS NOT NULL
  AND "loi_sent_to_broker_at" IS NULL;
