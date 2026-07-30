-- CreateEnum
CREATE TYPE "LenderInviteSource" AS ENUM ('ADMIN', 'BROKER');

-- AlterTable
ALTER TABLE "admin_lender_invites"
  ADD COLUMN IF NOT EXISTS "invited_by_broker_org_id" UUID,
  ADD COLUMN IF NOT EXISTS "invited_by_broker_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "token_used_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "invite_source" "LenderInviteSource" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "lender_profiles"
  ADD COLUMN IF NOT EXISTS "submitted_by_broker_org_id" UUID;
