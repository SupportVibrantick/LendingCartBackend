-- CreateEnum
CREATE TYPE "OrganizationGhlAgencyUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "organization_ghl_agency_users" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ghlUserId" TEXT NOT NULL,
    "ghlLocationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "OrganizationGhlAgencyUserStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "matchedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_ghl_agency_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_agency_users_userId_key" ON "organization_ghl_agency_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_agency_users_ghlUserId_key" ON "organization_ghl_agency_users"("ghlUserId");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_users_organizationId_idx" ON "organization_ghl_agency_users"("organizationId");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_users_ghlLocationId_idx" ON "organization_ghl_agency_users"("ghlLocationId");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_users_email_idx" ON "organization_ghl_agency_users"("email");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_users_status_idx" ON "organization_ghl_agency_users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_agency_users_organizationId_userId_key" ON "organization_ghl_agency_users"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "organization_ghl_agency_users" ADD CONSTRAINT "organization_ghl_agency_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ghl_agency_users" ADD CONSTRAINT "organization_ghl_agency_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
