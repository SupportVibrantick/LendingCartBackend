-- CreateTable
CREATE TABLE IF NOT EXISTS "ghl_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "webhookId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "ghlContactId" TEXT,
  "ghlInvoiceId" TEXT,
  "ghlSubscriptionId" TEXT,
  "checkoutId" UUID,
  "loanAiUserId" UUID,
  "errorMessage" TEXT,
  "payloadSummary" JSONB,
  "processedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ghl_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_webhook_events_webhookId_key"
  ON "ghl_webhook_events"("webhookId");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_eventType_idx"
  ON "ghl_webhook_events"("eventType");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_status_idx"
  ON "ghl_webhook_events"("status");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_ghlContactId_idx"
  ON "ghl_webhook_events"("ghlContactId");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_ghlInvoiceId_idx"
  ON "ghl_webhook_events"("ghlInvoiceId");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_checkoutId_idx"
  ON "ghl_webhook_events"("checkoutId");
