-- Org-level broker↔lender network chat (Marketplace / Broker Connections).
-- Loan-scoped conversations keep working; network threads have null loanApplicationId.

ALTER TABLE "Conversation" ALTER COLUMN "loanApplicationId" DROP NOT NULL;

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "brokerLenderAccessId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Conversation_brokerLenderAccessId_fkey'
  ) THEN
    ALTER TABLE "Conversation"
      ADD CONSTRAINT "Conversation_brokerLenderAccessId_fkey"
      FOREIGN KEY ("brokerLenderAccessId")
      REFERENCES "broker_lender_access"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_brokerLenderAccessId_chatCategory_key"
  ON "Conversation"("brokerLenderAccessId", "chatCategory");

CREATE INDEX IF NOT EXISTS "Conversation_brokerLenderAccessId_idx"
  ON "Conversation"("brokerLenderAccessId");
