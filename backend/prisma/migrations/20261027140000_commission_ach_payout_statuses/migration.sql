-- New enum values must be committed before a later migration can use them.
ALTER TYPE "CommissionPayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "CommissionPayoutStatus" ADD VALUE IF NOT EXISTS 'FAILED';

ALTER TYPE "CommissionAuditEventType" ADD VALUE IF NOT EXISTS 'PAYOUT_SUBMITTED';
ALTER TYPE "CommissionAuditEventType" ADD VALUE IF NOT EXISTS 'PAYOUT_SETTLED';
ALTER TYPE "CommissionAuditEventType" ADD VALUE IF NOT EXISTS 'PAYOUT_FAILED';
