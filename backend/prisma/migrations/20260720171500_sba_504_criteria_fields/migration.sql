-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "rateStructure" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "refinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "workingCapitalEligible" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "lifeInsuranceMayBeRequired" BOOLEAN DEFAULT false;
