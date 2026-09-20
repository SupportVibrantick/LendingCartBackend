-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "mezzPreferredFinancingType" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "acquisitionFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "constructionFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "bridgeFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "valueAddFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "recapitalizationAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equityGapFinancingAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "maxStabilizedLtvPercent" DECIMAL(5,2);
