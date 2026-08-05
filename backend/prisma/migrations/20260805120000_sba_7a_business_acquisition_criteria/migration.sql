-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "preferredDscr" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "maxTermRealEstateMonths" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "intangibleAssetsAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equipmentIncluded" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "realEstateIncluded" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "franchiseAcquisitionAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "collateralRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "collateralAsDownPaymentAllowed" BOOLEAN DEFAULT false;
