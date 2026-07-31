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
  isAnySba7aProduct,
  isAnySbaProduct,
} = require("../lender/lenderProductCriteria");

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
      item.minMezzLtvPercent !== undefined && item.minMezzLtvPercent !== null && item.minMezzLtvPercent !== ""
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
    minRateSpreadPercent:
      isSba7aRateSpreadProduct(code) && item.minRateSpreadPercent
        ? toDecimal(item.minRateSpreadPercent)
        : null,
    sbaGuaranteePercent:
      isAnySba7aProduct(code) && item.sbaGuaranteePercent
        ? toDecimal(item.sbaGuaranteePercent)
        : null,
    avgTurnaroundDays:
      isSba7aGeneralProduct(code) || isSba504Product(code)
        ? item.avgTurnaroundDays ?? null
        : null,
    preferredLenderPlp: isSba7aGeneralProduct(code)
      ? item.preferredLenderPlp ?? false
      : false,
    requiredInjectionPercent:
      (isSba7aBusinessAcquisitionProduct(code) || isSba504Product(code)) &&
      item.requiredInjectionPercent
        ? toDecimal(item.requiredInjectionPercent)
        : null,
    goodwillFinancingAllowed: isSba7aBusinessAcquisitionProduct(code)
      ? item.goodwillFinancingAllowed ?? false
      : false,
    sellerFinancingAllowed: isSba7aBusinessAcquisitionProduct(code)
      ? item.sellerFinancingAllowed ?? false
      : false,
    minLiquidityRequirement:
      isSba7aBusinessAcquisitionProduct(code) &&
      item.minLiquidityRequirement?.trim()
        ? item.minLiquidityRequirement.trim()
        : null,
    minTimeInBusinessMonths:
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code)
        ? item.minTimeInBusinessMonths ?? null
        : null,
    minAnnualRevenue:
      isSba7aWorkingCapitalProduct(code) && item.minAnnualRevenue
        ? toDecimal(item.minAnnualRevenue)
        : null,
    maxFinancingPercent:
      isSba7aWorkingCapitalProduct(code) && item.maxFinancingPercent
        ? toDecimal(item.maxFinancingPercent)
        : null,
    useOfFunds:
      (isSba7aWorkingCapitalProduct(code) || isSba504Product(code)) &&
      item.useOfFunds?.trim()
        ? item.useOfFunds.trim()
        : null,
    collateralRequirements:
      (isSba7aWorkingCapitalProduct(code) || isSba504Product(code)) &&
      item.collateralRequirements?.trim()
        ? item.collateralRequirements.trim()
        : null,
    startupAllowed:
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code)
        ? item.startupAllowed ?? false
        : false,
    rateStructure:
      isSba504Product(code) && item.rateStructure?.trim()
        ? item.rateStructure.trim()
        : null,
    refinanceAllowed: isSba504Product(code)
      ? item.refinanceAllowed ?? false
      : false,
    workingCapitalEligible: isSba504Product(code)
      ? item.workingCapitalEligible ?? false
      : false,
    lifeInsuranceMayBeRequired: isSba504Product(code)
      ? item.lifeInsuranceMayBeRequired ?? false
      : false,
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
    ownerOccupiedRequired:
      isSba7aRealEstateProduct(code) || isSba504Product(code)
        ? item.ownerOccupiedRequired ?? false
        : false,
    ownerOccupancyRequirement:
      (isSba7aRealEstateProduct(code) || isSba504Product(code)) &&
      item.ownerOccupancyRequirement?.trim()
        ? item.ownerOccupancyRequirement.trim()
        : null,
    environmentalReportRequired:
      isSba7aRealEstateProduct(code) || isSba504Product(code)
        ? item.environmentalReportRequired ?? false
        : false,
    appraisalRequired:
      isSba7aRealEstateProduct(code) || isSba504Product(code)
        ? item.appraisalRequired ?? false
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
      item.maxLtcPercent !== undefined &&
      item.maxLtcPercent !== null &&
      item.maxLtcPercent !== ""
        ? toDecimal(item.maxLtcPercent)
        : null,

    minCreditScore:
      item.minCreditScore !== undefined &&
      item.minCreditScore !== null &&
      item.minCreditScore !== ""
        ? Number(item.minCreditScore)
        : isPurchaseOrderFinanceProduct(code) ||
            isArFactoringProduct(code) ||
            isApSupplyChainProduct(code) ||
            isCmbsProduct(code) ||
            isAgencyMultifamilyProduct(code) ||
            isMezzanineProduct(code) ||
            isPreferredEquityProduct(code)
          ? null
          : null,

    minExperience:
      item.minExperience !== undefined &&
      item.minExperience !== null &&
      String(item.minExperience).trim() !== ""
        ? String(item.minExperience)
        : null,

    interestRateRange:
      isPreferredEquityProduct(code) ||
      isArFactoringProduct(code) ||
      isSba7aRateSpreadProduct(code)
        ? null
        : item.interestRateRange ?? null,

    originationPointsPercent:
      item.originationPointsPercent !== undefined &&
      item.originationPointsPercent !== null &&
      item.originationPointsPercent !== ""
        ? toDecimal(item.originationPointsPercent)
        : null,

    extensionAvailable: isBridgeLoanProduct(code)
      ? item.extensionAvailable ?? false
      : false,
    personalGuaranteeRequired:
      isBridgeLoanProduct(code) || isAnySbaProduct(code)
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
        isAgencyMultifamilyProduct(code) ||
        isAnySba7aProduct(code) ||
        isSba504Product(code)) &&
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
    prepaymentStructure:
      isCmbsProduct(code) ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code)
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
