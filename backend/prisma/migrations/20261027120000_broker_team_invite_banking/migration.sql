-- CreateEnum
CREATE TYPE "BrokerTeamInviteRole" AS ENUM ('LOAN_OFFICER', 'SUB_BROKER');

-- CreateEnum
CREATE TYPE "BankingAccountType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateTable
CREATE TABLE "broker_team_invites" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "BrokerTeamInviteRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "usedByUserId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_banking_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountType" "BankingAccountType" NOT NULL,
    "party_name" TEXT NOT NULL,
    "party_address" TEXT,
    "party_tel" TEXT,
    "party_email" TEXT,
    "bank_name" TEXT NOT NULL,
    "bank_tel" TEXT,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "aba_routing_number" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_banking_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broker_team_invites_token_key" ON "broker_team_invites"("token");

-- CreateIndex
CREATE INDEX "broker_team_invites_organizationId_role_usedAt_idx" ON "broker_team_invites"("organizationId", "role", "usedAt");

-- CreateIndex
CREATE INDEX "broker_team_invites_token_idx" ON "broker_team_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_banking_profiles_userId_key" ON "user_banking_profiles"("userId");

-- AddForeignKey
ALTER TABLE "broker_team_invites" ADD CONSTRAINT "broker_team_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_team_invites" ADD CONSTRAINT "broker_team_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_team_invites" ADD CONSTRAINT "broker_team_invites_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_banking_profiles" ADD CONSTRAINT "user_banking_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
