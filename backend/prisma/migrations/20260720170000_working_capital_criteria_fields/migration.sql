-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "useOfFunds" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "collateralRequirements" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "maxFinancingPercent" DECIMAL(5,2);
