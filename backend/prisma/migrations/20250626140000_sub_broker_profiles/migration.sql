-- CreateTable
CREATE TABLE IF NOT EXISTS "sub_broker_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileData" JSONB,
    "logoUrl" TEXT,
    "w9Url" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_broker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sub_broker_loan_officers" (
    "id" UUID NOT NULL,
    "subBrokerId" UUID NOT NULL,
    "loanOfficerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_broker_loan_officers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sub_broker_profiles_userId_key" ON "sub_broker_profiles"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sub_broker_loan_officers_subBrokerId_idx" ON "sub_broker_loan_officers"("subBrokerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sub_broker_loan_officers_loanOfficerId_idx" ON "sub_broker_loan_officers"("loanOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sub_broker_loan_officers_subBrokerId_loanOfficerId_key" ON "sub_broker_loan_officers"("subBrokerId", "loanOfficerId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sub_broker_profiles_userId_fkey'
    ) THEN
        ALTER TABLE "sub_broker_profiles"
        ADD CONSTRAINT "sub_broker_profiles_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sub_broker_loan_officers_subBrokerId_fkey'
    ) THEN
        ALTER TABLE "sub_broker_loan_officers"
        ADD CONSTRAINT "sub_broker_loan_officers_subBrokerId_fkey"
        FOREIGN KEY ("subBrokerId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sub_broker_loan_officers_loanOfficerId_fkey'
    ) THEN
        ALTER TABLE "sub_broker_loan_officers"
        ADD CONSTRAINT "sub_broker_loan_officers_loanOfficerId_fkey"
        FOREIGN KEY ("loanOfficerId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
