-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "maxTermEquipmentMonths" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "maximumDebtService" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "businessAcquisitionAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equipmentPurchaseAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "businessCreditRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "usOperatingBusinessRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "startupEligible" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "franchiseEligible" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "foreignOwnershipAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "bankruptcyAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "prepaymentPenalty" BOOLEAN DEFAULT false;
