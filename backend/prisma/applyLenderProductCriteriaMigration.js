/**
 * Idempotent lender_products criteria columns for product-specific loan guidelines.
 * Safe to run before seed when prisma migrate has not caught up yet.
 */
async function applyLenderProductCriteriaMigration(prisma) {
  const patches = [
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minMezzLtvPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxMezzLtvPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "exitFeePercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "preferredReturnPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "originationPointsPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "extensionAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "personalGuaranteeRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "firstTimeBorrowersAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minDscr" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minDebtYieldPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "amortizationYears" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minUnits" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "prepaymentStructure" TEXT`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minPropertiesInPortfolio" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxPropertiesInPortfolio" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "interestOnlyAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "shortTermRentalsOk" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "foreignNationalsAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "gcRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "completionGuaranteeRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "criteriaNotes" TEXT`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxRateSpreadPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "avgTurnaroundDays" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "preferredLenderPlp" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "requiredInjectionPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "goodwillFinancingAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "sellerFinancingAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minTimeInBusinessMonths" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "lineOfCreditAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "usedEquipmentAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "ownerOccupiedRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxTotalProjectAmount" DECIMAL(15,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxSba504DebentureAmount" DECIMAL(15,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "jobCreationRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxUsdaGuaranteeAmount" DECIMAL(15,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "usdaGuaranteePercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "ruralAreaRequired" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "advanceRatePercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "transactionFeePercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "minGrossMarginPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "internationalPosAllowed" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "saleLeasebackAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "discountFeePercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "maxInvoiceAgeDays" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "nonRecourseAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "governmentInvoicesOk" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "earlyPaymentDiscountPercent" DECIMAL(5,2)`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "paymentTermsExtensionDays" INTEGER`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "dynamicDiscountingAvailable" BOOLEAN DEFAULT false`,
    `ALTER TABLE "lender_products" ADD COLUMN IF NOT EXISTS "reverseFactoringAvailable" BOOLEAN DEFAULT false`,
  ];

  console.log("🔧 Applying lender product criteria column patches...");

  for (const sql of patches) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log("✅ Lender product criteria columns patched");
}

module.exports = { applyLenderProductCriteriaMigration };
