-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "leaseholdImprovementsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "existingBusinessAllowed" BOOLEAN DEFAULT false;
