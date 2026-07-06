-- JobLock table for distributed cron coordination
CREATE TABLE IF NOT EXISTS "job_locks" (
    "name" TEXT NOT NULL,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("name")
);

-- Document reminder scheduler job fields
ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;

ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ(6);

ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- Subscription invoice idempotency for billing cron
ALTER TABLE "subscription_invoices"
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_invoices_idempotencyKey_key"
    ON "subscription_invoices"("idempotencyKey");
