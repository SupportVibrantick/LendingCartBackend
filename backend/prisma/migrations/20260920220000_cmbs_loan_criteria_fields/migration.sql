-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "debtRefinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "minLoanSizeForPropertyTypeAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "badBoyGuaranteeRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "springingRecourseAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "defeasanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "yieldMaintenanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "interestOnlyPeriodMonths" INTEGER;
