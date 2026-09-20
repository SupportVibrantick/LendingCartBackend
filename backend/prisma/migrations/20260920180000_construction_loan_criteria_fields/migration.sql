-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minConstructionProjectsCompleted" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "tearDownRebuildAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "majorRenovationAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "constructionToPermanentAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "lotPurchaseIncluded" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "landAlreadyOwnedAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "landEquityAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "softCostsFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "hardCostsFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "contingencyFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "interestReserveFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "ownerBuilderAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "firstTimeBuilderAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "inspectionRequiredForDraws" BOOLEAN DEFAULT false;
