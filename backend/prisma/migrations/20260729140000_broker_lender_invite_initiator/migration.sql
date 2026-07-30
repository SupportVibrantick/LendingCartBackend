-- CreateEnum
CREATE TYPE "InviteInitiator" AS ENUM ('BROKER', 'LENDER');

-- AlterTable
ALTER TABLE "broker_lender_invites" ADD COLUMN "initiatedBy" "InviteInitiator";

-- Backfill: existing invites default to broker-initiated marketplace flow
UPDATE "broker_lender_invites"
SET "initiatedBy" = 'BROKER'
WHERE "initiatedBy" IS NULL;
