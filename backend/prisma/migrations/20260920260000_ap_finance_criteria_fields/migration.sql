-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minMonthlyPayablesAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "vendorSupplierFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "tradePayablesFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "inventoryFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "supplyChainFinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "domesticVendorsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "internationalVendorsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "governmentContractorsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "maxVendorConcentrationPercent" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "minVendorCreditQuality" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "vendorVerificationRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "purchaseOrderRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "minEligiblePayablesAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "maxPayablesConcentrationPercent" DECIMAL(5,2);
