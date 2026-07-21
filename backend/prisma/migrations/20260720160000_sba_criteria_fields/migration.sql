-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minRateSpreadPercent" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "sbaGuaranteePercent" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "minAnnualRevenue" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "startupAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "environmentalReportRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "appraisalRequired" BOOLEAN DEFAULT false;
