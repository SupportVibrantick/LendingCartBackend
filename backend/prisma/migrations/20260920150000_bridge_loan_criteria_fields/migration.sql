-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minPropertyValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "maxPropertyValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "unit1Allowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "unit2Allowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "unit3Allowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "unit4Allowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "ownerOccupiedAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "nonOwnerOccupiedAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "purchaseAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "cashOutRefinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "renovationAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "heavyRehabAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "lightRehabAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "vacantPropertyAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "tenantOccupiedAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "foreclosureReoAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "llcEntityBorrowerAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "propertyTypesExcluded" TEXT;
