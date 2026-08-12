-- AlterTable
ALTER TABLE "admin_manual_leads"
  ADD COLUMN IF NOT EXISTS "ghlSyncStatus" "GhlSyncStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
  ADD COLUMN IF NOT EXISTS "ghlSyncedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "ghlLastError" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_manual_leads_ghlSyncStatus_idx" ON "admin_manual_leads"("ghlSyncStatus");
