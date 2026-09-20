-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "portfolioRefinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "crossCollateralizationAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "residential1To4Allowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "minPortfolioValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "maxPortfolioValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "minPortfolioNoiAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "minPortfolioRentalIncomeAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "minCashReservesAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "minMonthsReserves" INTEGER;
