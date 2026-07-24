CREATE TABLE "lender_branding_settings" (
    "id" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_branding_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lender_branding_settings_lenderOrgId_key" ON "lender_branding_settings"("lenderOrgId");
CREATE INDEX "lender_branding_settings_lenderOrgId_idx" ON "lender_branding_settings"("lenderOrgId");

ALTER TABLE "lender_branding_settings"
ADD CONSTRAINT "lender_branding_settings_lenderOrgId_fkey"
FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
