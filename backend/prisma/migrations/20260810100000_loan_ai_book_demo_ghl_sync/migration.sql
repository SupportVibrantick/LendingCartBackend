-- CreateEnum
CREATE TYPE "GhlSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "loan_ai_book_demo_leads"
  ADD COLUMN IF NOT EXISTS "interestedPlanCode" TEXT,
  ADD COLUMN IF NOT EXISTS "interestedPlanName" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlSyncStatus" "GhlSyncStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlSyncedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "ghlLastError" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_ai_book_demo_leads_ghlSyncStatus_idx" ON "loan_ai_book_demo_leads"("ghlSyncStatus");
