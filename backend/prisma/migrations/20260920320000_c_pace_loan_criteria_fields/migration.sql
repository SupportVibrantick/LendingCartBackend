-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "constructionAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "energyEfficiencyImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "renewableEnergyImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "waterEfficiencyImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "resiliencyImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "seismicImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "hvacBuildingSystemsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "solarRenewableEnergyAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "roofImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "lightingImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "buildingEnvelopeAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "propertyOwnerConsentRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "seniorLenderConsentRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "mortgageLenderConsentRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "energyAuditRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "cPaceEligibleJurisdictions" TEXT;
