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
  isSbaExpressProduct,
  isSba504Product,
  isUsdaBiProduct,
  isCPaceProduct,
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
  const usesEquipmentTypes = isEquipmentFinance;
  const residential1To4 =
    isBridgeLoanProduct(code) ||
    isDscrRentalProduct(code) ||
    isFixAndFlipProduct(code) ||
    isConstructionLoanProduct(code);
  const mezzOrPref =
    isMezzanineProduct(code) || isPreferredEquityProduct(code);
  const cmbsProduct = isCmbsProduct(code);
  const rentalPortfolioProduct = isRentalPortfolioProduct(code);
  const equipmentFinanceProduct = isEquipmentFinanceProduct(code);
  const arFactoringProduct = isArFactoringProduct(code);
  const apSupplyChainProduct = isApSupplyChainProduct(code);
  const purchaseOrderProduct = isPurchaseOrderFinanceProduct(code);
  const cPaceProduct = isCPaceProduct(code);
  const occupancyBorrowerFlags =
    residential1To4 ||
    isCrePermanentProduct(code) ||
    isAgencyMultifamilyProduct(code) ||
    mezzOrPref ||
    cmbsProduct ||
    rentalPortfolioProduct;
  const creStylePropertyProduct =
    isCrePermanentProduct(code) ||
    isAgencyMultifamilyProduct(code) ||
    mezzOrPref ||
    cmbsProduct;

  return {
    businessTypes: item.businessTypes ?? null,
    propertyTypes: item.propertyTypes ?? null,

    minLoanAmount:
      !isNoMinLoanCriteriaProduct(code) && item.minLoanAmount
        ? toDecimal(item.minLoanAmount)
        : null,

    maxLoanAmount: item.maxLoanAmount ? toDecimal(item.maxLoanAmount) : null,

    minTermMonths: item.minTermMonths ?? null,
    maxTermMonths: item.maxTermMonths ?? null,

    maxLtvPercent:
      !isNoPropertyMetricsProduct(code) && item.maxLtvPercent
        ? toDecimal(item.maxLtvPercent)
        : null,

    minMezzLtvPercent:
      mezzOrPref &&
      item.minMezzLtvPercent !== undefined &&
      item.minMezzLtvPercent !== null &&
      item.minMezzLtvPercent !== ""
        ? toDecimal(item.minMezzLtvPercent)
        : item.minMezzLtvPercent !== undefined &&
            item.minMezzLtvPercent !== null &&
            item.minMezzLtvPercent !== ""
          ? toDecimal(item.minMezzLtvPercent)
          : null,
    maxMezzLtvPercent:
      mezzOrPref && item.maxMezzLtvPercent
        ? toDecimal(item.maxMezzLtvPercent)
        : null,
    exitFeePercent:
      mezzOrPref && item.exitFeePercent
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
      (isSba7aBusinessAcquisitionProduct(code) ||
        isSbaExpressProduct(code) ||
        isSba504Product(code)) &&
      item.requiredInjectionPercent
        ? toDecimal(item.requiredInjectionPercent)
        : null,
    goodwillFinancingAllowed:
      isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)
        ? item.goodwillFinancingAllowed ?? false
        : false,
    sellerFinancingAllowed:
      isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)
        ? item.sellerFinancingAllowed ?? false
        : false,
    preferredDscr:
      (isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)) &&
      item.preferredDscr
        ? toDecimal(item.preferredDscr)
        : null,
    maxTermRealEstateMonths:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.maxTermRealEstateMonths ?? null
        : null,
    maxTermEquipmentMonths:
      isSbaExpressProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.maxTermEquipmentMonths ?? null
        : null,
    maxTermWorkingCapitalMonths: isUsdaBiProduct(code)
      ? item.maxTermWorkingCapitalMonths ?? null
      : null,
    maximumDebtService:
      isSbaExpressProduct(code) && item.maximumDebtService
        ? toDecimal(item.maximumDebtService)
        : null,
    intangibleAssetsAllowed:
      isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)
        ? item.intangibleAssetsAllowed ?? false
        : false,
    equipmentIncluded:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aRealEstateProduct(code)
        ? item.equipmentIncluded ?? false
        : false,
    realEstateIncluded:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aWorkingCapitalProduct(code)
        ? item.realEstateIncluded ?? false
        : false,
    franchiseAcquisitionAllowed:
      isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)
        ? item.franchiseAcquisitionAllowed ?? false
        : false,
    collateralRequired:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      equipmentFinanceProduct
        ? item.collateralRequired ?? false
        : false,
    collateralAsDownPaymentAllowed:
      isSba7aBusinessAcquisitionProduct(code) || isSbaExpressProduct(code)
        ? item.collateralAsDownPaymentAllowed ?? false
        : false,
    businessAcquisitionAllowed:
      isSbaExpressProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.businessAcquisitionAllowed ?? false
        : false,
    equipmentPurchaseAllowed:
      isSbaExpressProduct(code) ||
      equipmentFinanceProduct ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.equipmentPurchaseAllowed ?? false
        : false,
    businessCreditRequired: isSbaExpressProduct(code)
      ? item.businessCreditRequired ?? false
      : false,
    usOperatingBusinessRequired: isSbaExpressProduct(code)
      ? item.usOperatingBusinessRequired ?? false
      : false,
    startupEligible: isSbaExpressProduct(code)
      ? item.startupEligible ?? false
      : false,
    franchiseEligible:
      isSbaExpressProduct(code) || isSba7aEquipmentPurchaseProduct(code)
        ? item.franchiseEligible ?? false
        : false,
    foreignOwnershipAllowed:
      isSbaExpressProduct(code) ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? item.foreignOwnershipAllowed ?? false
        : false,
    bankruptcyAllowed:
      isSbaExpressProduct(code) ||
      isBridgeLoanProduct(code) ||
      isDscrRentalProduct(code) ||
      isFixAndFlipProduct(code) ||
      isConstructionLoanProduct(code) ||
      rentalPortfolioProduct ||
      equipmentFinanceProduct ||
      isSba7aEquipmentPurchaseProduct(code)
        ? item.bankruptcyAllowed ?? false
        : false,
    prepaymentPenalty:
      isSbaExpressProduct(code) ||
      isBridgeLoanProduct(code) ||
      isDscrRentalProduct(code) ||
      isFixAndFlipProduct(code) ||
      isConstructionLoanProduct(code)
        ? item.prepaymentPenalty ?? false
        : false,
    minLiquidityRequirement:
      isSba7aBusinessAcquisitionProduct(code) &&
      item.minLiquidityRequirement?.trim()
        ? item.minLiquidityRequirement.trim()
        : null,
    minTimeInBusinessMonths:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      rentalPortfolioProduct ||
      equipmentFinanceProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? item.minTimeInBusinessMonths ?? null
        : null,
    minAnnualRevenue:
      (isSba7aWorkingCapitalProduct(code) ||
        isBridgeLoanProduct(code) ||
        equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        isSba7aRealEstateProduct(code) ||
        isSba7aEquipmentPurchaseProduct(code) ||
        isSba504Product(code) ||
        isUsdaBiProduct(code)) &&
      item.minAnnualRevenue
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
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      equipmentFinanceProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? item.startupAllowed ?? false
        : false,
    rateStructure:
      isSba504Product(code) && item.rateStructure?.trim()
        ? item.rateStructure.trim()
        : null,
    refinanceAllowed:
      isSbaExpressProduct(code) ||
      isSba504Product(code) ||
      isBridgeLoanProduct(code) ||
      isDscrRentalProduct(code) ||
      isFixAndFlipProduct(code) ||
      mezzOrPref ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct
        ? item.refinanceAllowed ?? false
        : false,
    workingCapitalEligible:
      isSba7aBusinessAcquisitionProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba504Product(code) ||
      equipmentFinanceProduct ||
      isSba7aWorkingCapitalProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isUsdaBiProduct(code)
        ? item.workingCapitalEligible ?? false
        : false,
    lifeInsuranceMayBeRequired: isSba504Product(code)
      ? item.lifeInsuranceMayBeRequired ?? false
      : false,
    lineOfCreditAvailable: isSba7aWorkingCapitalProduct(code)
      ? item.lineOfCreditAvailable ?? false
      : false,
    seasonalWorkingCapitalAllowed: isSba7aWorkingCapitalProduct(code)
      ? item.seasonalWorkingCapitalAllowed ?? false
      : false,
    accountsReceivableFinancingAllowed: isSba7aWorkingCapitalProduct(code)
      ? item.accountsReceivableFinancingAllowed ?? false
      : false,
    usedEquipmentAllowed:
      isSba7aEquipmentPurchaseProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.usedEquipmentAllowed ?? false
        : false,
    leaseholdImprovementsAllowed:
      isSba7aEquipmentPurchaseProduct(code) || isUsdaBiProduct(code)
        ? item.leaseholdImprovementsAllowed ?? false
        : false,
    existingBusinessAllowed: isSba7aEquipmentPurchaseProduct(code)
      ? item.existingBusinessAllowed ?? false
      : false,
    saleLeasebackAvailable:
      isSbaExpressProduct(code) || isEquipmentFinanceProduct(code)
        ? item.saleLeasebackAvailable ?? false
        : false,
    advanceRatePercent:
      (isPurchaseOrderFinanceProduct(code) ||
        arFactoringProduct ||
        apSupplyChainProduct) &&
      item.advanceRatePercent
        ? toDecimal(item.advanceRatePercent)
        : null,
    maxAdvanceRatePercent:
      (arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct) &&
      item.maxAdvanceRatePercent
        ? toDecimal(item.maxAdvanceRatePercent)
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
      arFactoringProduct && item.discountFeePercent
        ? toDecimal(item.discountFeePercent)
        : null,
    maxInvoiceAgeDays:
      arFactoringProduct || apSupplyChainProduct
        ? item.maxInvoiceAgeDays ?? null
        : null,
    minInvoiceAgeDays:
      arFactoringProduct || apSupplyChainProduct
        ? item.minInvoiceAgeDays ?? null
        : null,
    nonRecourseAvailable:
      arFactoringProduct ||
      creStylePropertyProduct ||
      rentalPortfolioProduct ||
      cPaceProduct
        ? item.nonRecourseAvailable ?? false
        : false,
    governmentInvoicesOk: arFactoringProduct
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
      isSbaExpressProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code)
        ? item.ownerOccupiedRequired ?? false
        : false,
    ownerOccupancyRequirement:
      (isSba7aRealEstateProduct(code) || isSba504Product(code)) &&
      item.ownerOccupancyRequirement?.trim()
        ? item.ownerOccupancyRequirement.trim()
        : null,
    environmentalReportRequired:
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct ||
      creStylePropertyProduct ||
      rentalPortfolioProduct
        ? item.environmentalReportRequired ?? false
        : false,
    appraisalRequired:
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct ||
      creStylePropertyProduct ||
      rentalPortfolioProduct
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
      (isBridgeLoanProduct(code) ||
        isConstructionLoanProduct(code) ||
        (!isDscrRentalProduct(code) &&
          !isRentalPortfolioProduct(code) &&
          !isCrePermanentProduct(code) &&
          !isCmbsProduct(code) &&
          !isAgencyMultifamilyProduct(code) &&
          !isMezzanineProduct(code) &&
          !isPreferredEquityProduct(code) &&
          !isNoPropertyMetricsProduct(code))) &&
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
        : null,

    minExperience:
      item.minExperience !== undefined &&
      item.minExperience !== null &&
      String(item.minExperience).trim() !== ""
        ? String(item.minExperience)
        : null,

    interestRateRange: isSba7aRateSpreadProduct(code)
      ? null
      : item.interestRateRange ?? null,

    originationPointsPercent:
      item.originationPointsPercent !== undefined &&
      item.originationPointsPercent !== null &&
      item.originationPointsPercent !== ""
        ? toDecimal(item.originationPointsPercent)
        : null,

    extensionAvailable: false,
    personalGuaranteeRequired:
      occupancyBorrowerFlags ||
      isAnySbaProduct(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct ||
      equipmentFinanceProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? item.personalGuaranteeRequired ?? false
        : false,
    firstTimeBorrowersAllowed: isFixAndFlipProduct(code)
      ? item.firstTimeInvestorAllowed ?? item.firstTimeBorrowersAllowed ?? false
      : false,

    minDscr:
      (isBridgeLoanProduct(code) ||
        isDscrRentalProduct(code) ||
        isRentalPortfolioProduct(code) ||
        isCrePermanentProduct(code) ||
        isCmbsProduct(code) ||
        isAgencyMultifamilyProduct(code) ||
        mezzOrPref ||
        equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        isAnySba7aProduct(code) ||
        isSba504Product(code) ||
        isUsdaBiProduct(code) ||
        cPaceProduct) &&
      item.minDscr
        ? toDecimal(item.minDscr)
        : null,
    minDebtYieldPercent:
      (isCrePermanentProduct(code) ||
        isCmbsProduct(code) ||
        isAgencyMultifamilyProduct(code) ||
        mezzOrPref ||
        rentalPortfolioProduct ||
        cPaceProduct) &&
      item.minDebtYieldPercent
        ? toDecimal(item.minDebtYieldPercent)
        : null,
    amortizationYears: isSbaExpressProduct(code)
      ? item.amortizationYears ?? null
      : null,
    amortizationMonths:
      isCrePermanentProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      cmbsProduct ||
      rentalPortfolioProduct ||
      cPaceProduct
        ? item.amortizationMonths ?? null
        : null,
    minUnits:
      isAgencyMultifamilyProduct(code) || isCrePermanentProduct(code)
        ? item.minUnits ?? null
        : null,
    maxUnits:
      isCrePermanentProduct(code) || isAgencyMultifamilyProduct(code)
        ? item.maxUnits ?? null
        : null,
    prepaymentStructure:
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
    interestOnlyAvailable:
      occupancyBorrowerFlags || cPaceProduct
        ? item.interestOnlyAvailable ?? false
        : false,
    shortTermRentalsOk:
      isDscrRentalProduct(code) ||
      isBridgeLoanProduct(code) ||
      rentalPortfolioProduct
        ? item.shortTermRentalsOk ?? false
        : false,
    foreignNationalsAllowed:
      occupancyBorrowerFlags ||
      equipmentFinanceProduct ||
      isSba7aEquipmentPurchaseProduct(code)
        ? item.foreignNationalsAllowed ?? false
        : false,
    minPropertyValueAmount:
      (isBridgeLoanProduct(code) ||
        creStylePropertyProduct ||
        rentalPortfolioProduct ||
        cPaceProduct) &&
      item.minPropertyValueAmount
        ? toDecimal(item.minPropertyValueAmount)
        : null,
    maxPropertyValueAmount:
      (isBridgeLoanProduct(code) ||
        creStylePropertyProduct ||
        rentalPortfolioProduct ||
        cPaceProduct) &&
      item.maxPropertyValueAmount
        ? toDecimal(item.maxPropertyValueAmount)
        : null,
    unit1Allowed: residential1To4 ? item.unit1Allowed ?? false : false,
    unit2Allowed: residential1To4 ? item.unit2Allowed ?? false : false,
    unit3Allowed: residential1To4 ? item.unit3Allowed ?? false : false,
    unit4Allowed: residential1To4 ? item.unit4Allowed ?? false : false,
    ownerOccupiedAllowed:
      occupancyBorrowerFlags ||
      isSba7aRealEstateProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.ownerOccupiedAllowed ?? false
        : false,
    nonOwnerOccupiedAllowed: occupancyBorrowerFlags
      ? item.nonOwnerOccupiedAllowed ?? false
      : false,
    investmentPropertyAllowed: isSba7aRealEstateProduct(code)
      ? item.investmentPropertyAllowed ?? false
      : false,
    commercialRealEstateAllowed:
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.commercialRealEstateAllowed ?? false
        : false,
    purchaseAllowed:
      occupancyBorrowerFlags ||
      isSba7aRealEstateProduct(code) ||
      cPaceProduct
        ? item.purchaseAllowed ?? false
        : false,
    cashOutRefinanceAllowed:
      occupancyBorrowerFlags ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct
        ? item.cashOutRefinanceAllowed ?? false
        : false,
    renovationAllowed:
      isBridgeLoanProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct
        ? item.renovationAllowed ?? false
        : false,
    heavyRehabAllowed:
      isBridgeLoanProduct(code) || isFixAndFlipProduct(code)
        ? item.heavyRehabAllowed ?? false
        : false,
    lightRehabAllowed:
      isBridgeLoanProduct(code) ||
      isFixAndFlipProduct(code) ||
      rentalPortfolioProduct
        ? item.lightRehabAllowed ?? false
        : false,
    vacantPropertyAllowed:
      residential1To4 || rentalPortfolioProduct
        ? item.vacantPropertyAllowed ?? false
        : false,
    tenantOccupiedAllowed: isBridgeLoanProduct(code)
      ? item.tenantOccupiedAllowed ?? false
      : false,
    foreclosureReoAllowed:
      isBridgeLoanProduct(code) || isFixAndFlipProduct(code)
        ? item.foreclosureReoAllowed ?? false
        : false,
    llcEntityBorrowerAllowed:
      occupancyBorrowerFlags || equipmentFinanceProduct
        ? item.llcEntityBorrowerAllowed ?? false
        : false,
    propertyTypesExcluded:
      (occupancyBorrowerFlags || cPaceProduct) &&
      item.propertyTypesExcluded?.trim()
        ? item.propertyTypesExcluded.trim()
        : null,
    maxLtvCashOutPercent:
      isDscrRentalProduct(code) && item.maxLtvCashOutPercent
        ? toDecimal(item.maxLtvCashOutPercent)
        : null,
    minRentalIncomeAmount:
      isDscrRentalProduct(code) && item.minRentalIncomeAmount
        ? toDecimal(item.minRentalIncomeAmount)
        : null,
    rentalIncomeRequired: isDscrRentalProduct(code)
      ? item.rentalIncomeRequired ?? false
      : false,
    longTermRentalAllowed:
      isDscrRentalProduct(code) || rentalPortfolioProduct
        ? item.longTermRentalAllowed ?? false
        : false,
    leaseRequired:
      isDscrRentalProduct(code) || rentalPortfolioProduct
        ? item.leaseRequired ?? false
        : false,
    marketRentScheduleAccepted:
      isDscrRentalProduct(code) || rentalPortfolioProduct
        ? item.marketRentScheduleAccepted ?? false
        : false,
    firstTimeInvestorAllowed:
      isDscrRentalProduct(code) ||
      isFixAndFlipProduct(code) ||
      rentalPortfolioProduct
        ? item.firstTimeInvestorAllowed ?? false
        : false,
    foreclosureShortSaleAllowed:
      isDscrRentalProduct(code) || rentalPortfolioProduct
        ? item.foreclosureShortSaleAllowed ?? false
        : false,
    minInvestorExperienceDeals: isFixAndFlipProduct(code)
      ? item.minInvestorExperienceDeals ?? null
      : null,
    moderateRehabAllowed: isFixAndFlipProduct(code)
      ? item.moderateRehabAllowed ?? false
      : false,
    groundUpConstructionAllowed:
      isFixAndFlipProduct(code) ||
      isConstructionLoanProduct(code) ||
      mezzOrPref ||
      cmbsProduct ||
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct
        ? item.groundUpConstructionAllowed ?? false
        : false,
    shortSaleAllowed: isFixAndFlipProduct(code)
      ? item.shortSaleAllowed ?? false
      : false,
    borrowerExperienceRequired: isFixAndFlipProduct(code)
      ? item.borrowerExperienceRequired ?? false
      : false,
    rehabFundsFinanced: isFixAndFlipProduct(code)
      ? item.rehabFundsFinanced ?? false
      : false,
    rehabFundsMaxPercent:
      isFixAndFlipProduct(code) && item.rehabFundsMaxPercent
        ? toDecimal(item.rehabFundsMaxPercent)
        : null,
    drawScheduleRequired:
      isFixAndFlipProduct(code) || isConstructionLoanProduct(code)
        ? item.drawScheduleRequired ?? false
        : false,
    gcRequired: isConstructionLoanProduct(code)
      ? item.gcRequired ?? false
      : false,
    completionGuaranteeRequired:
      isConstructionLoanProduct(code) || mezzOrPref
        ? item.completionGuaranteeRequired ?? false
        : false,
    minConstructionProjectsCompleted: isConstructionLoanProduct(code)
      ? item.minConstructionProjectsCompleted ?? null
      : null,
    tearDownRebuildAllowed: isConstructionLoanProduct(code)
      ? item.tearDownRebuildAllowed ?? false
      : false,
    majorRenovationAllowed: isConstructionLoanProduct(code)
      ? item.majorRenovationAllowed ?? false
      : false,
    constructionToPermanentAllowed: isConstructionLoanProduct(code)
      ? item.constructionToPermanentAllowed ?? false
      : false,
    lotPurchaseIncluded: isConstructionLoanProduct(code)
      ? item.lotPurchaseIncluded ?? false
      : false,
    landAlreadyOwnedAllowed: isConstructionLoanProduct(code)
      ? item.landAlreadyOwnedAllowed ?? false
      : false,
    landEquityAllowed: isConstructionLoanProduct(code)
      ? item.landEquityAllowed ?? false
      : false,
    softCostsFinanced:
      isConstructionLoanProduct(code) ||
      equipmentFinanceProduct ||
      isSba7aEquipmentPurchaseProduct(code)
        ? item.softCostsFinanced ?? false
        : false,
    hardCostsFinanced: isConstructionLoanProduct(code)
      ? item.hardCostsFinanced ?? false
      : false,
    contingencyFinanced: isConstructionLoanProduct(code)
      ? item.contingencyFinanced ?? false
      : false,
    interestReserveFinanced: isConstructionLoanProduct(code)
      ? item.interestReserveFinanced ?? false
      : false,
    ownerBuilderAllowed: isConstructionLoanProduct(code)
      ? item.ownerBuilderAllowed ?? false
      : false,
    firstTimeBuilderAllowed: isConstructionLoanProduct(code)
      ? item.firstTimeBuilderAllowed ?? false
      : false,
    inspectionRequiredForDraws: isConstructionLoanProduct(code)
      ? item.inspectionRequiredForDraws ?? false
      : false,
    minOwnershipExperienceYears:
      creStylePropertyProduct || cPaceProduct
        ? item.minOwnershipExperienceYears ?? null
        : null,
    rateTermRefinanceAllowed:
      isCrePermanentProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      cmbsProduct ||
      rentalPortfolioProduct
        ? item.rateTermRefinanceAllowed ?? false
        : false,
    multifamily5PlusAllowed:
      creStylePropertyProduct ||
      rentalPortfolioProduct ||
      isSba7aRealEstateProduct(code) ||
      isUsdaBiProduct(code) ||
      cPaceProduct
        ? item.multifamily5PlusAllowed ?? false
        : false,
    apartmentAllowed:
      isCrePermanentProduct(code) || cmbsProduct
        ? item.apartmentAllowed ?? false
        : false,
    officeAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.officeAllowed ?? false
        : false,
    retailAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.retailAllowed ?? false
        : false,
    industrialAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.industrialAllowed ?? false
        : false,
    mixedUseAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.mixedUseAllowed ?? false
        : false,
    selfStorageAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.selfStorageAllowed ?? false
        : false,
    hotelHospitalityAllowed:
      isCrePermanentProduct(code) || mezzOrPref || cmbsProduct || cPaceProduct
        ? item.hotelHospitalityAllowed ?? false
        : false,
    medicalHealthcareAllowed:
      isCrePermanentProduct(code) || cmbsProduct || cPaceProduct
        ? item.medicalHealthcareAllowed ?? false
        : false,
    studentHousingAllowed: creStylePropertyProduct
      ? item.studentHousingAllowed ?? false
      : false,
    mobileHomeParkAllowed:
      isCrePermanentProduct(code) || cmbsProduct
        ? item.mobileHomeParkAllowed ?? false
        : false,
    seniorHousingAllowed: creStylePropertyProduct
      ? item.seniorHousingAllowed ?? false
      : false,
    minOccupancyPercent:
      (creStylePropertyProduct || rentalPortfolioProduct || cPaceProduct) &&
      item.minOccupancyPercent
        ? toDecimal(item.minOccupancyPercent)
        : null,
    minAnnualNoiAmount:
      (creStylePropertyProduct || cPaceProduct) && item.minAnnualNoiAmount
        ? toDecimal(item.minAnnualNoiAmount)
        : null,
    stabilizedPropertyRequired:
      creStylePropertyProduct || cPaceProduct
        ? item.stabilizedPropertyRequired ?? false
        : false,
    leaseUpPropertiesAccepted: creStylePropertyProduct
      ? item.leaseUpPropertiesAccepted ?? false
      : false,
    valueAddPropertiesAccepted:
      creStylePropertyProduct || rentalPortfolioProduct || cPaceProduct
        ? item.valueAddPropertiesAccepted ?? false
        : false,
    newlyRenovatedPropertiesAllowed: isCrePermanentProduct(code)
      ? item.newlyRenovatedPropertiesAllowed ?? false
      : false,
    propertyConditionAssessmentRequired:
      creStylePropertyProduct || rentalPortfolioProduct || cPaceProduct
        ? item.propertyConditionAssessmentRequired ?? false
        : false,
    agencyProgram: isAgencyMultifamilyProduct(code)
      ? item.agencyProgram ?? null
      : null,
    supplementalFinancingAllowed: isAgencyMultifamilyProduct(code)
      ? item.supplementalFinancingAllowed ?? false
      : false,
    marketRateMultifamilyAllowed: isAgencyMultifamilyProduct(code)
      ? item.marketRateMultifamilyAllowed ?? false
      : false,
    affordableHousingAllowed: isAgencyMultifamilyProduct(code)
      ? item.affordableHousingAllowed ?? false
      : false,
    cooperativeHousingAllowed: isAgencyMultifamilyProduct(code)
      ? item.cooperativeHousingAllowed ?? false
      : false,
    manufacturedHousingCommunityAllowed: isAgencyMultifamilyProduct(code)
      ? item.manufacturedHousingCommunityAllowed ?? false
      : false,
    smallBalanceMultifamilyAllowed: isAgencyMultifamilyProduct(code)
      ? item.smallBalanceMultifamilyAllowed ?? false
      : false,
    minDscrFixedRate:
      isAgencyMultifamilyProduct(code) && item.minDscrFixedRate
        ? toDecimal(item.minDscrFixedRate)
        : null,
    minDscrArm:
      isAgencyMultifamilyProduct(code) && item.minDscrArm
        ? toDecimal(item.minDscrArm)
        : null,
    newConstructionAllowed:
      isAgencyMultifamilyProduct(code) || cPaceProduct
        ? item.newConstructionAllowed ?? false
        : false,
    renovationModerateRehabAllowed: isAgencyMultifamilyProduct(code)
      ? item.renovationModerateRehabAllowed ?? false
      : false,
    mezzPreferredFinancingType: mezzOrPref
      ? item.mezzPreferredFinancingType ?? null
      : null,
    acquisitionFinancingAllowed: mezzOrPref
      ? item.acquisitionFinancingAllowed ?? false
      : false,
    constructionFinancingAllowed: mezzOrPref
      ? item.constructionFinancingAllowed ?? false
      : false,
    bridgeFinancingAllowed: mezzOrPref
      ? item.bridgeFinancingAllowed ?? false
      : false,
    valueAddFinancingAllowed: mezzOrPref
      ? item.valueAddFinancingAllowed ?? false
      : false,
    recapitalizationAllowed: mezzOrPref
      ? item.recapitalizationAllowed ?? false
      : false,
    equityGapFinancingAllowed: mezzOrPref
      ? item.equityGapFinancingAllowed ?? false
      : false,
    maxStabilizedLtvPercent:
      mezzOrPref && item.maxStabilizedLtvPercent
        ? toDecimal(item.maxStabilizedLtvPercent)
        : null,
    debtRefinanceAllowed: cmbsProduct
      ? item.debtRefinanceAllowed ?? false
      : false,
    minLoanSizeForPropertyTypeAmount:
      cmbsProduct && item.minLoanSizeForPropertyTypeAmount
        ? toDecimal(item.minLoanSizeForPropertyTypeAmount)
        : null,
    badBoyGuaranteeRequired: cmbsProduct
      ? item.badBoyGuaranteeRequired ?? false
      : false,
    springingRecourseAllowed: cmbsProduct
      ? item.springingRecourseAllowed ?? false
      : false,
    defeasanceAllowed: cmbsProduct
      ? item.defeasanceAllowed ?? false
      : false,
    yieldMaintenanceAllowed: cmbsProduct
      ? item.yieldMaintenanceAllowed ?? false
      : false,
    interestOnlyPeriodMonths: cmbsProduct
      ? item.interestOnlyPeriodMonths ?? null
      : null,
    portfolioRefinanceAllowed: rentalPortfolioProduct
      ? item.portfolioRefinanceAllowed ?? false
      : false,
    crossCollateralizationAllowed: rentalPortfolioProduct
      ? item.crossCollateralizationAllowed ?? false
      : false,
    residential1To4Allowed: rentalPortfolioProduct
      ? item.residential1To4Allowed ?? false
      : false,
    minPortfolioValueAmount:
      rentalPortfolioProduct && item.minPortfolioValueAmount
        ? toDecimal(item.minPortfolioValueAmount)
        : null,
    maxPortfolioValueAmount:
      rentalPortfolioProduct && item.maxPortfolioValueAmount
        ? toDecimal(item.maxPortfolioValueAmount)
        : null,
    minPortfolioNoiAmount:
      rentalPortfolioProduct && item.minPortfolioNoiAmount
        ? toDecimal(item.minPortfolioNoiAmount)
        : null,
    minPortfolioRentalIncomeAmount:
      rentalPortfolioProduct && item.minPortfolioRentalIncomeAmount
        ? toDecimal(item.minPortfolioRentalIncomeAmount)
        : null,
    minCashReservesAmount:
      rentalPortfolioProduct && item.minCashReservesAmount
        ? toDecimal(item.minCashReservesAmount)
        : null,
    minMonthsReserves: rentalPortfolioProduct
      ? item.minMonthsReserves ?? null
      : null,
    minEbitdaAmount:
      (equipmentFinanceProduct ||
        isSba7aWorkingCapitalProduct(code) ||
        isSba7aRealEstateProduct(code) ||
        isSba7aEquipmentPurchaseProduct(code) ||
        isSba504Product(code) ||
        isUsdaBiProduct(code)) &&
      item.minEbitdaAmount
        ? toDecimal(item.minEbitdaAmount)
        : null,
    newEquipmentAllowed:
      equipmentFinanceProduct ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code)
        ? item.newEquipmentAllowed ?? false
        : false,
    equipmentRefinanceAllowed:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.equipmentRefinanceAllowed ?? false
        : false,
    equipmentLeaseAllowed: equipmentFinanceProduct
      ? item.equipmentLeaseAllowed ?? false
      : false,
    leaseToOwnAllowed: equipmentFinanceProduct
      ? item.leaseToOwnAllowed ?? false
      : false,
    installationCostsFinanced:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.installationCostsFinanced ?? false
        : false,
    transportationFreightCostsFinanced: equipmentFinanceProduct
      ? item.transportationFreightCostsFinanced ?? false
      : false,
    firstTimeBusinessOwnersAllowed: equipmentFinanceProduct
      ? item.firstTimeBusinessOwnersAllowed ?? false
      : false,
    minEquipmentValueAmount:
      (equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)) &&
      item.minEquipmentValueAmount
        ? toDecimal(item.minEquipmentValueAmount)
        : null,
    maxEquipmentValueAmount:
      (equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)) &&
      item.maxEquipmentValueAmount
        ? toDecimal(item.maxEquipmentValueAmount)
        : null,
    maxEquipmentAgeYears:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.maxEquipmentAgeYears ?? null
        : null,
    minUsefulLifeRemainingYears:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.minUsefulLifeRemainingYears ?? null
        : null,
    equipmentAppraisalRequired:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.equipmentAppraisalRequired ?? false
        : false,
    vendorInvoiceRequired:
      equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)
        ? item.vendorInvoiceRequired ?? false
        : false,
    equipmentTypesExcluded:
      (equipmentFinanceProduct || isSba7aEquipmentPurchaseProduct(code)) &&
      item.equipmentTypesExcluded?.trim()
        ? item.equipmentTypesExcluded.trim()
        : null,
    industriesExcluded:
      (equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        isSba7aWorkingCapitalProduct(code) ||
        isSba7aRealEstateProduct(code) ||
        isSba7aEquipmentPurchaseProduct(code) ||
        isSba504Product(code) ||
        isUsdaBiProduct(code)) &&
      item.industriesExcluded?.trim()
        ? item.industriesExcluded.trim()
        : null,
    minMonthlyArAmount:
      arFactoringProduct && item.minMonthlyArAmount
        ? toDecimal(item.minMonthlyArAmount)
        : null,
    recourseFactoringAllowed: arFactoringProduct
      ? item.recourseFactoringAllowed ?? false
      : false,
    invoiceFactoringAllowed: arFactoringProduct
      ? item.invoiceFactoringAllowed ?? false
      : false,
    arLineOfCreditAllowed: arFactoringProduct
      ? item.arLineOfCreditAllowed ?? false
      : false,
    assetBasedLendingAllowed: arFactoringProduct
      ? item.assetBasedLendingAllowed ?? false
      : false,
    purchaseOrderFinancingAllowed:
      arFactoringProduct || apSupplyChainProduct
        ? item.purchaseOrderFinancingAllowed ?? false
        : false,
    domesticArAllowed: arFactoringProduct
      ? item.domesticArAllowed ?? false
      : false,
    internationalArAllowed: arFactoringProduct
      ? item.internationalArAllowed ?? false
      : false,
    b2bReceivablesAllowed:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? item.b2bReceivablesAllowed ?? false
        : false,
    b2cReceivablesAllowed:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? item.b2cReceivablesAllowed ?? false
        : false,
    concentrationLimitPercent:
      arFactoringProduct && item.concentrationLimitPercent
        ? toDecimal(item.concentrationLimitPercent)
        : null,
    minInvoiceSizeAmount:
      (arFactoringProduct || apSupplyChainProduct) &&
      item.minInvoiceSizeAmount
        ? toDecimal(item.minInvoiceSizeAmount)
        : null,
    maxInvoiceSizeAmount:
      (arFactoringProduct || apSupplyChainProduct) &&
      item.maxInvoiceSizeAmount
        ? toDecimal(item.maxInvoiceSizeAmount)
        : null,
    maxInvoiceDilutionPercent:
      arFactoringProduct && item.maxInvoiceDilutionPercent
        ? toDecimal(item.maxInvoiceDilutionPercent)
        : null,
    minDebtorCreditScore: arFactoringProduct
      ? item.minDebtorCreditScore ?? null
      : null,
    customerCreditInsuranceRequired: arFactoringProduct
      ? item.customerCreditInsuranceRequired ?? false
      : false,
    existingLiensAccepted:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? item.existingLiensAccepted ?? false
        : false,
    taxLiensAccepted:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? item.taxLiensAccepted ?? false
        : false,
    uccFilingRequired:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? item.uccFilingRequired ?? false
        : false,
    minEligibleArAmount:
      arFactoringProduct && item.minEligibleArAmount
        ? toDecimal(item.minEligibleArAmount)
        : null,
    maxArConcentrationPercent:
      arFactoringProduct && item.maxArConcentrationPercent
        ? toDecimal(item.maxArConcentrationPercent)
        : null,
    minMonthlyPayablesAmount:
      apSupplyChainProduct && item.minMonthlyPayablesAmount
        ? toDecimal(item.minMonthlyPayablesAmount)
        : null,
    vendorSupplierFinancingAllowed: apSupplyChainProduct
      ? item.vendorSupplierFinancingAllowed ?? false
      : false,
    tradePayablesFinancingAllowed: apSupplyChainProduct
      ? item.tradePayablesFinancingAllowed ?? false
      : false,
    inventoryFinancingAllowed:
      apSupplyChainProduct ||
      isSba7aWorkingCapitalProduct(code) ||
      isUsdaBiProduct(code)
        ? item.inventoryFinancingAllowed ?? false
        : false,
    supplyChainFinanceAllowed: apSupplyChainProduct
      ? item.supplyChainFinanceAllowed ?? false
      : false,
    domesticVendorsAllowed: apSupplyChainProduct
      ? item.domesticVendorsAllowed ?? false
      : false,
    internationalVendorsAllowed: apSupplyChainProduct
      ? item.internationalVendorsAllowed ?? false
      : false,
    governmentContractorsAllowed: apSupplyChainProduct
      ? item.governmentContractorsAllowed ?? false
      : false,
    maxVendorConcentrationPercent:
      apSupplyChainProduct && item.maxVendorConcentrationPercent
        ? toDecimal(item.maxVendorConcentrationPercent)
        : null,
    minVendorCreditQuality:
      apSupplyChainProduct && item.minVendorCreditQuality?.trim()
        ? item.minVendorCreditQuality.trim()
        : null,
    vendorVerificationRequired:
      apSupplyChainProduct || purchaseOrderProduct
        ? item.vendorVerificationRequired ?? false
        : false,
    purchaseOrderRequired: apSupplyChainProduct
      ? item.purchaseOrderRequired ?? false
      : false,
    minEligiblePayablesAmount:
      apSupplyChainProduct && item.minEligiblePayablesAmount
        ? toDecimal(item.minEligiblePayablesAmount)
        : null,
    maxPayablesConcentrationPercent:
      apSupplyChainProduct && item.maxPayablesConcentrationPercent
        ? toDecimal(item.maxPayablesConcentrationPercent)
        : null,
    domesticPosAllowed: purchaseOrderProduct
      ? item.domesticPosAllowed ?? false
      : false,
    governmentPosAllowed: purchaseOrderProduct
      ? item.governmentPosAllowed ?? false
      : false,
    recurringPosAllowed: purchaseOrderProduct
      ? item.recurringPosAllowed ?? false
      : false,
    oneTimePosAllowed: purchaseOrderProduct
      ? item.oneTimePosAllowed ?? false
      : false,
    manufacturingRequired: purchaseOrderProduct
      ? item.manufacturingRequired ?? false
      : false,
    finishedGoodsAllowed: purchaseOrderProduct
      ? item.finishedGoodsAllowed ?? false
      : false,
    rawMaterialsAllowed: purchaseOrderProduct
      ? item.rawMaterialsAllowed ?? false
      : false,
    supplierVendorPaymentAllowed: purchaseOrderProduct
      ? item.supplierVendorPaymentAllowed ?? false
      : false,
    purchaseOrderAssignmentAllowed: purchaseOrderProduct
      ? item.purchaseOrderAssignmentAllowed ?? false
      : false,
    minPoAmountAmount:
      purchaseOrderProduct && item.minPoAmountAmount
        ? toDecimal(item.minPoAmountAmount)
        : null,
    maxPoAmountAmount:
      purchaseOrderProduct && item.maxPoAmountAmount
        ? toDecimal(item.maxPoAmountAmount)
        : null,
    minCustomerCreditScore: purchaseOrderProduct
      ? item.minCustomerCreditScore ?? null
      : null,
    minCustomerCreditRating:
      purchaseOrderProduct && item.minCustomerCreditRating?.trim()
        ? item.minCustomerCreditRating.trim()
        : null,
    maxCustomerConcentrationPercent:
      purchaseOrderProduct && item.maxCustomerConcentrationPercent
        ? toDecimal(item.maxCustomerConcentrationPercent)
        : null,
    minGrossProfitMarginPercent:
      purchaseOrderProduct && item.minGrossProfitMarginPercent
        ? toDecimal(item.minGrossProfitMarginPercent)
        : null,
    minCustomerDepositPercent:
      purchaseOrderProduct && item.minCustomerDepositPercent
        ? toDecimal(item.minCustomerDepositPercent)
        : null,
    customerVerificationRequired: purchaseOrderProduct
      ? item.customerVerificationRequired ?? false
      : false,
    minEligiblePoValueAmount:
      purchaseOrderProduct && item.minEligiblePoValueAmount
        ? toDecimal(item.minEligiblePoValueAmount)
        : null,
    maxPoConcentrationPercent:
      purchaseOrderProduct && item.maxPoConcentrationPercent
        ? toDecimal(item.maxPoConcentrationPercent)
        : null,
    constructionAllowed: cPaceProduct
      ? item.constructionAllowed ?? false
      : false,
    energyEfficiencyImprovementsAllowed: cPaceProduct
      ? item.energyEfficiencyImprovementsAllowed ?? false
      : false,
    renewableEnergyImprovementsAllowed: cPaceProduct
      ? item.renewableEnergyImprovementsAllowed ?? false
      : false,
    waterEfficiencyImprovementsAllowed: cPaceProduct
      ? item.waterEfficiencyImprovementsAllowed ?? false
      : false,
    resiliencyImprovementsAllowed: cPaceProduct
      ? item.resiliencyImprovementsAllowed ?? false
      : false,
    seismicImprovementsAllowed: cPaceProduct
      ? item.seismicImprovementsAllowed ?? false
      : false,
    hvacBuildingSystemsAllowed: cPaceProduct
      ? item.hvacBuildingSystemsAllowed ?? false
      : false,
    solarRenewableEnergyAllowed: cPaceProduct
      ? item.solarRenewableEnergyAllowed ?? false
      : false,
    roofImprovementsAllowed: cPaceProduct
      ? item.roofImprovementsAllowed ?? false
      : false,
    lightingImprovementsAllowed: cPaceProduct
      ? item.lightingImprovementsAllowed ?? false
      : false,
    buildingEnvelopeAllowed: cPaceProduct
      ? item.buildingEnvelopeAllowed ?? false
      : false,
    propertyOwnerConsentRequired: cPaceProduct
      ? item.propertyOwnerConsentRequired ?? false
      : false,
    seniorLenderConsentRequired: cPaceProduct
      ? item.seniorLenderConsentRequired ?? false
      : false,
    mortgageLenderConsentRequired: cPaceProduct
      ? item.mortgageLenderConsentRequired ?? false
      : false,
    energyAuditRequired: cPaceProduct
      ? item.energyAuditRequired ?? false
      : false,
    cPaceEligibleJurisdictions: cPaceProduct
      ? toCsv(item.cPaceEligibleJurisdictions) ||
        (typeof item.cPaceEligibleJurisdictions === "string"
          ? item.cPaceEligibleJurisdictions.trim() || null
          : null)
      : null,
    criteriaNotes: item.criteriaNotes ?? null,

    statesSupported: toCsv(item.statesSupported),

    equipmentTypes:
      usesEquipmentTypes && item.equipmentTypes
        ? toCsv(
            Array.isArray(item.equipmentTypes)
              ? item.equipmentTypes
              : String(item.equipmentTypes).split(","),
          )
        : null,
    otherEquipmentExplanation: usesEquipmentTypes
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
