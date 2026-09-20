-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "agencyProgram" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "supplementalFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "marketRateMultifamilyAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "affordableHousingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "cooperativeHousingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "manufacturedHousingCommunityAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "smallBalanceMultifamilyAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "minDscrFixedRate" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "minDscrArm" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "newConstructionAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "renovationModerateRehabAllowed" BOOLEAN DEFAULT false;
