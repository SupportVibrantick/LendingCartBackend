-- CreateEnum
CREATE TYPE "OrganizationGhlConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'REVOKED');

-- CreateTable
CREATE TABLE "organization_ghl_connections" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ghlLocationId" TEXT NOT NULL,
    "ghlCompanyId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMPTZ(6),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMPTZ(6),
    "connectedByUserId" UUID,
    "status" "OrganizationGhlConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_ghl_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_connections_organizationId_key" ON "organization_ghl_connections"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ghl_connections_ghlLocationId_key" ON "organization_ghl_connections"("ghlLocationId");

-- CreateIndex
CREATE INDEX "organization_ghl_connections_ghlLocationId_idx" ON "organization_ghl_connections"("ghlLocationId");

-- CreateIndex
CREATE INDEX "organization_ghl_connections_status_idx" ON "organization_ghl_connections"("status");

-- CreateIndex
CREATE INDEX "organization_ghl_connections_connectedByUserId_idx" ON "organization_ghl_connections"("connectedByUserId");

-- CreateIndex
CREATE INDEX "organization_ghl_connections_tokenExpiresAt_idx" ON "organization_ghl_connections"("tokenExpiresAt");

-- AddForeignKey
ALTER TABLE "organization_ghl_connections" ADD CONSTRAINT "organization_ghl_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ghl_connections" ADD CONSTRAINT "organization_ghl_connections_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
