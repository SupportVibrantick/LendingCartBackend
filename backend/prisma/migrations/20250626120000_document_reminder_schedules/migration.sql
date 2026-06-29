-- CreateEnum
CREATE TYPE "DocumentReminderRecipientType" AS ENUM ('CLIENT', 'LENDER');

-- CreateEnum
CREATE TYPE "DocumentReminderType" AS ENUM ('PENDING_UPLOAD', 'SIGNATURE_REQUIRED', 'LENDER_REVIEW');

-- CreateEnum
CREATE TYPE "DocumentReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "document_reminder_schedules" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "recipientType" "DocumentReminderRecipientType" NOT NULL,
    "reminderType" "DocumentReminderType" NOT NULL,
    "applicationLenderId" UUID,
    "intervalValue" INTEGER NOT NULL DEFAULT 1,
    "intervalUnit" "CampaignIntervalUnit" NOT NULL DEFAULT 'DAYS',
    "status" "DocumentReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "customMessage" TEXT,
    "lastSentAt" TIMESTAMPTZ(6),
    "nextRunAt" TIMESTAMPTZ(6),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_reminder_schedules_loanApplicationId_recipientType__idx" ON "document_reminder_schedules"("loanApplicationId", "recipientType", "reminderType");

-- CreateIndex
CREATE INDEX "document_reminder_schedules_brokerOrgId_idx" ON "document_reminder_schedules"("brokerOrgId");

-- CreateIndex
CREATE INDEX "document_reminder_schedules_status_nextRunAt_idx" ON "document_reminder_schedules"("status", "nextRunAt");

-- AddForeignKey
ALTER TABLE "document_reminder_schedules" ADD CONSTRAINT "document_reminder_schedules_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminder_schedules" ADD CONSTRAINT "document_reminder_schedules_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminder_schedules" ADD CONSTRAINT "document_reminder_schedules_applicationLenderId_fkey" FOREIGN KEY ("applicationLenderId") REFERENCES "application_lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminder_schedules" ADD CONSTRAINT "document_reminder_schedules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
