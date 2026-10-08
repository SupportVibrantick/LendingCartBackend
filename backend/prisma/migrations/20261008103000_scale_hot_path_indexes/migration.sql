-- Indexes for the queries that run on every dashboard, notification list, and chat page.
-- Safe to re-run: IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS "loan_applications_brokerOrgId_submittedAt_idx"
  ON "loan_applications"("brokerOrgId", "submittedAt");

CREATE INDEX IF NOT EXISTS "loan_applications_brokerOrgId_fundedAt_idx"
  ON "loan_applications"("brokerOrgId", "funded_at");

CREATE INDEX IF NOT EXISTS "broker_applications_brokerOrgId_createdAt_idx"
  ON "broker_applications"("brokerOrgId", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_recipientUserId_deletedAt_createdAt_idx"
  ON "notifications"("recipientUserId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_recipientOrgId_deletedAt_createdAt_idx"
  ON "notifications"("recipientOrgId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
