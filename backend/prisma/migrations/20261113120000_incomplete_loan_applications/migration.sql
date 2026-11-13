-- Incomplete loan applications: optional client, wizard draft JSON, new status.

DO $$ BEGIN
  ALTER TYPE "LoanApplicationStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "loan_applications" ALTER COLUMN "clientId" DROP NOT NULL;

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "incomplete_draft" JSONB;
