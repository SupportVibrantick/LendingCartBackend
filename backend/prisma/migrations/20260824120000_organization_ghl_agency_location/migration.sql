-- CreateEnum
CREATE TYPE "OrganizationGhlAgencyLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "organization_ghl_agency_locations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageCode" TEXT NOT NULL,
    "ghlCompanyId" TEXT NOT NULL,
    "ghlLocationId" TEXT NOT NULL,
    "status" "OrganizationGhlAgencyLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "assignedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_ghl_agency_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_agency_locations_organizationId_key" ON "organization_ghl_agency_locations"("organizationId");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_locations_ghlLocationId_idx" ON "organization_ghl_agency_locations"("ghlLocationId");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_locations_status_idx" ON "organization_ghl_agency_locations"("status");

-- CreateIndex
CREATE INDEX "organization_ghl_agency_locations_packageCode_idx" ON "organization_ghl_agency_locations"("packageCode");

-- AddForeignKey
ALTER TABLE "organization_ghl_agency_locations" ADD CONSTRAINT "organization_ghl_agency_locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
