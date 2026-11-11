-- Branding is owned by the lender org; allow org hard-delete without RESTRICT.
ALTER TABLE "lender_branding_settings"
DROP CONSTRAINT "lender_branding_settings_lenderOrgId_fkey";

ALTER TABLE "lender_branding_settings"
ADD CONSTRAINT "lender_branding_settings_lenderOrgId_fkey"
FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
