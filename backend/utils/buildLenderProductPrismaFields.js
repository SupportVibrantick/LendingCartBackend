const { Prisma } = require("@prisma/client");
const {
  isBridgeLoanProduct,
  isFixAndFlipProduct,
  isDscrRentalProduct,
  isRentalPortfolioProduct,
  isConstructionLoanProduct,
  isCrePermanentProduct,
  isCmbsProduct,
  isAgencyMultifamilyProduct,
  isMezzanineProduct,
  isPreferredEquityProduct,
  isSba7aGeneralProduct,
  isSba7aBusinessAcquisitionProduct,
  isSba7aWorkingCapitalProduct,
  isSba7aEquipmentPurchaseProduct,
  isSba7aRealEstateProduct,
  isSba504Product,
  isUsdaBiProduct,
  isPurchaseOrderFinanceProduct,
  isEquipmentFinanceProduct,
  isArFactoringProduct,
  isApSupplyChainProduct,
  isNoMinLoanCriteriaProduct,
  isNoPropertyMetricsProduct,
  isSba7aRateSpreadProduct,
  supportsLtcPercent,
} = require("./lenderProductCriteria");

function toDecimal(val) {
  return val !== undefined && val !== null && val !== ""
    ? new Prisma.Decimal(val)
    : null;
}

function toCsv(arr) {
  return Array.isArray(arr) && arr.length
    ? arr.map((v) => String(v).trim()).filter(Boolean).join(",")
    : null;
}

/**
 * Map a lender-product API item to Prisma `lenderProduct` data fields.
 * Shared by lender and admin create/update routes.
 */
function buildLenderProductPrismaFields(item) {
  const code = item.loanProductCode;
  const isEquipmentFinance = code === "EQUIPMENT_FINANCE";

  return {
    businessTypes: item.businessTypes ?? null,
    propertyTypes: item.propertyTypes ?? null,

    minLoanAmount:
      !isNoMinLoanCriteriaProduct(code) && item.minLoanAmount
        ? toDecimal(item.minLoanAmount)
        : null,

    maxLoanAmount:
      !isSba504Product(code) && item.maxLoanAmount
        ? toDecimal(item.maxLoanAmount)
        : null,

    minTermMonths: item.minTermMonths ?? null,
    maxTermMonths: item.maxTermMonths ?? null,

    maxLtvPercent:
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !isNoPropertyMetricsProduct(code) &&
      item.maxLtvPercent
        ? toDecimal(item.maxLtvPercent)
        : null,

    minMezzLtvPercent:
      isMezzanineProduct(code) && item.minMezzLtvPercent
        ? toDecimal(item.minMezzLtvPercent)
        : null,
    maxMezzLtvPercent:
      isMezzanineProduct(code) && item.maxMezzLtvPercent
        ? toDecimal(item.maxMezzLtvPercent)
        : null,
    exitFeePercent:
      (isMezzanineProduct(code) || isPreferredEquityProduct(code)) &&
      item.exitFeePercent
        ? toDecimal(item.exitFeePercent)
        : null,
    preferredReturnPercent:
      isPreferredEquityProduct(code) && item.preferredReturnPercent
        ? toDecimal(item.preferredReturnPercent)
        : null,
    maxRateSpreadPercent:
      isSba7aRateSpreadProduct(code) && item.maxRateSpreadPercent
        ? toDecimal(item.maxRateSpreadPercent)
        : null,
    avgTurnaroundDays: isSba7aGeneralProduct(code)
      ? item.avgTurnaroundDays ?? null
      : null,
    preferredLenderPlp: isSba7aGeneralProduct(code)
      ? item.preferredLenderPlp ?? false
      : false,
    requiredInjectionPercent:
      isSba7aBusinessAcquisitionProduct(code) && item.requiredInjectionPercent
        ? toDecimal(item.requiredInjectionPercent)
        : null,
    goodwillFinancingAllowed: isSba7aBusinessAcquisitionProduct(code)
      ? item.goodwillFinancingAllowed ?? false
      : false,
    sellerFinancingAllowed: isSba7aBusinessAcquisitionProduct(code)
      ? item.sellerFinancingAllowed ?? false
      : false,
    minTimeInBusinessMonths: isSba7aWorkingCapitalProduct(code)
      ? item.minTimeInBusinessMonths ?? null
      : null,
    lineOfCreditAvailable: isSba7aWorkingCapitalProduct(code)
      ? item.lineOfCreditAvailable ?? false
      : false,
    usedEquipmentAllowed:
      isSba7aEquipmentPurchaseProduct(code) || isEquipmentFinanceProduct(code)
        ? item.usedEquipmentAllowed ?? false
        : false,
    saleLeasebackAvailable: isEquipmentFinanceProduct(code)
      ? item.saleLeasebackAvailable ?? false
      : false,
    advanceRatePercent:
      (isPurchaseOrderFinanceProduct(code) || isArFactoringProduct(code)) &&
      item.advanceRatePercent
        ? toDecimal(item.advanceRatePercent)
        : null,
    transactionFeePercent:
      isPurchaseOrderFinanceProduct(code) && item.transactionFeePercent
        ? toDecimal(item.transactionFeePercent)
        : null,
    minGrossMarginPercent:
      isPurchaseOrderFinanceProduct(code) && item.minGrossMarginPercent
        ? toDecimal(item.minGrossMarginPercent)
        : null,
    internationalPosAllowed: isPurchaseOrderFinanceProduct(code)
      ? item.internationalPosAllowed ?? false
      : false,
    discountFeePercent:
      isArFactoringProduct(code) && item.discountFeePercent
        ? toDecimal(item.discountFeePercent)
        : null,
    maxInvoiceAgeDays: isArFactoringProduct(code)
      ? item.maxInvoiceAgeDays ?? null
      : null,
    nonRecourseAvailable: isArFactoringProduct(code)
      ? item.nonRecourseAvailable ?? false
      : false,
    governmentInvoicesOk: isArFactoringProduct(code)
      ? item.governmentInvoicesOk ?? false
      : false,
    earlyPaymentDiscountPercent:
      isApSupplyChainProduct(code) && item.earlyPaymentDiscountPercent
        ? toDecimal(item.earlyPaymentDiscountPercent)
        : null,
    paymentTermsExtensionDays: isApSupplyChainProduct(code)
      ? item.paymentTermsExtensionDays ?? null
      : null,
    dynamicDiscountingAvailable: isApSupplyChainProduct(code)
      ? item.dynamicDiscountingAvailable ?? false
      : false,
    reverseFactoringAvailable: isApSupplyChainProduct(code)
      ? item.reverseFactoringAvailable ?? false
      : false,
    ownerOccupiedRequired: isSba7aRealEstateProduct(code)
      ? item.ownerOccupiedRequired ?? false
      : false,
    maxTotalProjectAmount:
      isSba504Product(code) && item.maxTotalProjectAmount
        ? toDecimal(item.maxTotalProjectAmount)
        : null,
    maxSba504DebentureAmount:
      isSba504Product(code) && item.maxSba504DebentureAmount
        ? toDecimal(item.maxSba504DebentureAmount)
        : null,
    jobCreationRequired: isSba504Product(code)
      ? item.jobCreationRequired ?? false
      : false,
    maxUsdaGuaranteeAmount:
      isUsdaBiProduct(code) && item.maxUsdaGuaranteeAmount
        ? toDecimal(item.maxUsdaGuaranteeAmount)
        : null,
    usdaGuaranteePercent:
      isUsdaBiProduct(code) && item.usdaGuaranteePercent
        ? toDecimal(item.usdaGuaranteePercent)
        : null,
    ruralAreaRequired: isUsdaBiProduct(code)
      ? item.ruralAreaRequired ?? false
      : false,

    maxArvPercent:
      !isBridgeLoanProduct(code) &&
      !isDscrRentalProduct(code) &&
      !isRentalPortfolioProduct(code) &&
      !isConstructionLoanProduct(code) &&
      !isCrePermanentProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !isNoPropertyMetricsProduct(code) &&
      item.maxArvPercent
        ? toDecimal(item.maxArvPercent)
        : null,

    maxLtcPercent:
      supportsLtcPercent(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !isNoPropertyMetricsProduct(code) &&
      item.maxLtcPercent
        ? toDecimal(item.maxLtcPercent)
        : null,

    minCreditScore:
      isPurchaseOrderFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isCmbsProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      isMezzanineProduct(code) ||
      isPreferredEquityProduct(code)
        ? null
        : item.minCreditScore ?? null,

    minExperience:
      !isBridgeLoanProduct(code) &&
      !isFixAndFlipProduct(code) &&
      !isDscrRentalProduct(code) &&
      !isRentalPortfolioProduct(code) &&
      !isConstructionLoanProduct(code) &&
      !isCrePermanentProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !isNoPropertyMetricsProduct(code) &&
      item.minExperience !== undefined
        ? String(item.minExperience)
        : null,

    interestRateRange:
      isPreferredEquityProduct(code) ||
      isNoMinLoanCriteriaProduct(code) ||
      isPurchaseOrderFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code)
        ? null
        : item.interestRateRange ?? null,

    originationPointsPercent:
      !isRentalPortfolioProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isNoPropertyMetricsProduct(code) &&
      item.originationPointsPercent !== undefined &&
      item.originationPointsPercent !== null &&
      item.originationPointsPercent !== ""
        ? toDecimal(item.originationPointsPercent)
        : null,

    extensionAvailable: isBridgeLoanProduct(code)
      ? item.extensionAvailable ?? false
      : false,
    personalGuaranteeRequired: isBridgeLoanProduct(code)
      ? item.personalGuaranteeRequired ?? false
      : false,
    firstTimeBorrowersAllowed: isFixAndFlipProduct(code)
      ? item.firstTimeBorrowersAllowed ?? false
      : false,

    minDscr:
      (isDscrRentalProduct(code) ||
        isRentalPortfolioProduct(code) ||
        isCrePermanentProduct(code) ||
        isCmbsProduct(code) ||
        isAgencyMultifamilyProduct(code)) &&
      item.minDscr
        ? toDecimal(item.minDscr)
        : null,
    minDebtYieldPercent:
      (isCrePermanentProduct(code) || isCmbsProduct(code)) &&
      item.minDebtYieldPercent
        ? toDecimal(item.minDebtYieldPercent)
        : null,
    amortizationYears:
      isCrePermanentProduct(code) ||
      isCmbsProduct(code) ||
      isAgencyMultifamilyProduct(code)
        ? item.amortizationYears ?? null
        : null,
    minUnits: isAgencyMultifamilyProduct(code) ? item.minUnits ?? null : null,
    prepaymentStructure: isCmbsProduct(code)
      ? item.prepaymentStructure ?? null
      : null,
    minPropertiesInPortfolio: isRentalPortfolioProduct(code)
      ? item.minPropertiesInPortfolio ?? null
      : null,
    maxPropertiesInPortfolio: isRentalPortfolioProduct(code)
      ? item.maxPropertiesInPortfolio ?? null
      : null,
    interestOnlyAvailable: isDscrRentalProduct(code)
      ? item.interestOnlyAvailable ?? false
      : false,
    shortTermRentalsOk: isDscrRentalProduct(code)
      ? item.shortTermRentalsOk ?? false
      : false,
    foreignNationalsAllowed: isDscrRentalProduct(code)
      ? item.foreignNationalsAllowed ?? false
      : false,
    gcRequired: isConstructionLoanProduct(code)
      ? item.gcRequired ?? false
      : false,
    completionGuaranteeRequired: isConstructionLoanProduct(code)
      ? item.completionGuaranteeRequired ?? false
      : false,
    criteriaNotes: item.criteriaNotes ?? null,

    statesSupported: toCsv(item.statesSupported),

    equipmentTypes:
      isEquipmentFinance && item.equipmentTypes
        ? toCsv(
            Array.isArray(item.equipmentTypes)
              ? item.equipmentTypes
              : String(item.equipmentTypes).split(","),
          )
        : null,
    otherEquipmentExplanation: isEquipmentFinance
      ? item.otherEquipmentExplanation ?? null
      : null,

    isActive: item.isActive ?? true,
  };
}

module.exports = {
  buildLenderProductPrismaFields,
  toDecimal,
  toCsv,
};
