-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "seasonalWorkingCapitalAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "accountsReceivableFinancingAllowed" BOOLEAN DEFAULT false;
