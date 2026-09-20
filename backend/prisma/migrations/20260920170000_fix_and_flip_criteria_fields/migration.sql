-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minInvestorExperienceDeals" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "moderateRehabAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "groundUpConstructionAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "shortSaleAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "borrowerExperienceRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "rehabFundsFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "rehabFundsMaxPercent" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "drawScheduleRequired" BOOLEAN DEFAULT false;
