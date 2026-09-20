-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN "minEbitdaAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "newEquipmentAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equipmentRefinanceAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equipmentLeaseAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "leaseToOwnAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "installationCostsFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "transportationFreightCostsFinanced" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "firstTimeBusinessOwnersAllowed" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "minEquipmentValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "maxEquipmentValueAmount" DECIMAL(20,2);
ALTER TABLE "lender_products" ADD COLUMN "maxEquipmentAgeYears" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "minUsefulLifeRemainingYears" INTEGER;
ALTER TABLE "lender_products" ADD COLUMN "equipmentAppraisalRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "vendorInvoiceRequired" BOOLEAN DEFAULT false;
ALTER TABLE "lender_products" ADD COLUMN "equipmentTypesExcluded" TEXT;
ALTER TABLE "lender_products" ADD COLUMN "industriesExcluded" TEXT;
