/*
  Warnings:

  - A unique constraint covering the columns `[applicationLenderId,chatCategory]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Conversation_applicationLenderId_key";

-- AlterTable
ALTER TABLE "loan_ai_users" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "subscription_packages" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_applicationLenderId_chatCategory_key" ON "Conversation"("applicationLenderId", "chatCategory");

-- CreateIndex
CREATE INDEX "application_document_requirements_request_application_lende_idx" ON "application_document_requirements"("request_application_lender_id");

-- CreateIndex
CREATE INDEX "deal_commissions_status_idx" ON "deal_commissions"("status");

-- RenameIndex
ALTER INDEX "deal_commissions_loan_application_id_recipient_user_id_recipi_k" RENAME TO "deal_commissions_loan_application_id_recipient_user_id_reci_key";
