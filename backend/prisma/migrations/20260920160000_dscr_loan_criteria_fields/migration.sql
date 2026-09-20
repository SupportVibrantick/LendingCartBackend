-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "maxLtvCashOutPercent" DECIMAL(5,2);
ALTER TABLE "lender_products" ADD COLUMN "minRentalIncomeAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "rentalIncomeRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "longTermRentalAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "leaseRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "marketRentScheduleAccepted" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "firstTimeInvestorAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "foreclosureShortSaleAllowed" BOOLEAN DEFAULT false;
