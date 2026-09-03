CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE IF NOT EXISTS "loan_officer_applications" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "loanOfficerId" UUID NOT NULL,
    "assignedById" UUID,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_officer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_officer_applications_loanApplicationId_idx" ON "loan_officer_applications"("loanApplicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_officer_applications_loanOfficerId_idx" ON "loan_officer_applications"("loanOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loan_officer_applications_loanApplicationId_loanOfficerId_key" ON "loan_officer_applications"("loanApplicationId", "loanOfficerId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'loan_officer_applications_loanApplicationId_fkey'
    ) THEN
        ALTER TABLE "loan_officer_applications"
        ADD CONSTRAINT "loan_officer_applications_loanApplicationId_fkey"
        FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'loan_officer_applications_loanOfficerId_fkey'
    ) THEN
        ALTER TABLE "loan_officer_applications"
        ADD CONSTRAINT "loan_officer_applications_loanOfficerId_fkey"
        FOREIGN KEY ("loanOfficerId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'loan_officer_applications_assignedById_fkey'
    ) THEN
        ALTER TABLE "loan_officer_applications"
        ADD CONSTRAINT "loan_officer_applications_assignedById_fkey"
        FOREIGN KEY ("assignedById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing single-officer assignments from loan_applications.brokerUserId
INSERT INTO "loan_officer_applications" ("id", "loanApplicationId", "loanOfficerId", "assignedAt")
SELECT gen_random_uuid(), la.id, la."brokerUserId", CURRENT_TIMESTAMP
FROM "loan_applications" la
INNER JOIN "user_roles" ur ON ur."userId" = la."brokerUserId"
INNER JOIN "roles" r ON r.id = ur."roleId"
WHERE la."brokerUserId" IS NOT NULL
  AND r.name = 'BROKER_OFFICER'
ON CONFLICT ("loanApplicationId", "loanOfficerId") DO NOTHING;
