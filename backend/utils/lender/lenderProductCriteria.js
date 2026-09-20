const BRIDGE_LOAN_CODES = new Set([
  "BRIDGE_LOAN",
  "BRIDGE_LOAN_1_TO_4_UNITS",
  "BRIDGE",
]);

const FIX_AND_FLIP_CODES = new Set([
  "FIX_AND_FLIP",
  "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
]);

const DSCR_RENTAL_CODES = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "DSCR",
  "DSCR_RENTAL",
]);

const RENTAL_PORTFOLIO_CODES = new Set(["RENTAL_PORTFOLIO"]);

const CONSTRUCTION_LOAN_CODES = new Set([
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
  "CONSTRUCTION",
  "GROUND_UP_CONSTRUCTION",
  "CONSTRUCTION_TO_PERM",
  "COMMERCIAL_CONSTRUCTION",
]);

const CRE_PERMANENT_LOAN_CODES = new Set(["CRE_PERMANENT_LOAN"]);

const CMBS_LOAN_CODES = new Set(["CMBS"]);

const AGENCY_MULTIFAMILY_LOAN_CODES = new Set(["AGENCY_LOAN_MULTIFAMILY"]);

const MEZZANINE_LOAN_CODES = new Set([
  "MEZZANINE_FINANCE",
  "MEZZ_FINANCE",
]);

const PREFERRED_EQUITY_LOAN_CODES = new Set([
  "PREFERRED_EQUITY",
  "MEZZ_FINANCE_PREF_EQUITY",
]);

const SBA_7A_GENERAL_LOAN_CODES = new Set(["SBA_7A"]);

const SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES = new Set([
  "SBA_7A_BUSINESS_ACQUISITION",
]);

const SBA_7A_WORKING_CAPITAL_LOAN_CODES = new Set([
  "SBA_7A_WORKING_CAPITAL",
]);

const SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES = new Set([
  "SBA_7A_EQUIPMENT_PURCHASE",
]);

const SBA_7A_REAL_ESTATE_LOAN_CODES = new Set(["SBA_7A_REAL_ESTATE"]);

const SBA_EXPRESS_LOAN_CODES = new Set(["SBA_EXPRESS"]);

const SBA_504_LOAN_CODES = new Set([
  "SBA_504",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "SBA_504_REAL_ESTATE_EQUIPMENT",
]);

const USDA_BI_LOAN_CODES = new Set(["USDA_BI"]);

const C_PACE_LOAN_CODES = new Set(["C_PACE"]);

const PURCHASE_ORDER_FINANCE_LOAN_CODES = new Set([
  "PURCHASE_ORDER_FINANCE",
]);

const EQUIPMENT_FINANCE_LOAN_CODES = new Set(["EQUIPMENT_FINANCE"]);

const INVOICE_FACTORING_LOAN_CODES = new Set(["INVOICE_FACTORING"]);

const ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES = new Set([
  "ACCOUNTS_PAYABLE_FINANCE",
]);

const LTC_LOAN_CODES = new Set([
  "MEZZ_FINANCE",
  "MEZZANINE_FINANCE",
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
  "CRE_PERMANENT_LOAN",
  "AGENCY_LOAN_MULTIFAMILY",
  "CMBS",
  "RENTAL_PORTFOLIO",
  "EQUIPMENT_FINANCE",
  "PREFERRED_EQUITY",
  "MEZZ_FINANCE_PREF_EQUITY",
  "C_PACE",
  ...FIX_AND_FLIP_CODES,
  ...BRIDGE_LOAN_CODES,
]);

const supportsLtcPercent = (loanProductCode) =>
  LTC_LOAN_CODES.has(loanProductCode) ||
  isSba7aBusinessAcquisitionProduct(loanProductCode) ||
  isSba7aWorkingCapitalProduct(loanProductCode) ||
  isSba7aRealEstateProduct(loanProductCode) ||
  isSba7aEquipmentPurchaseProduct(loanProductCode) ||
  isSbaExpressProduct(loanProductCode) ||
  isSba504Product(loanProductCode) ||
  isUsdaBiProduct(loanProductCode);

const isBridgeLoanProduct = (loanProductCode) =>
  BRIDGE_LOAN_CODES.has(loanProductCode);

const isFixAndFlipProduct = (loanProductCode) =>
  FIX_AND_FLIP_CODES.has(loanProductCode);

const isDscrRentalProduct = (loanProductCode) =>
  DSCR_RENTAL_CODES.has(loanProductCode);

const isRentalPortfolioProduct = (loanProductCode) =>
  RENTAL_PORTFOLIO_CODES.has(loanProductCode);

const isConstructionLoanProduct = (loanProductCode) =>
  CONSTRUCTION_LOAN_CODES.has(loanProductCode);

const isCrePermanentProduct = (loanProductCode) =>
  CRE_PERMANENT_LOAN_CODES.has(loanProductCode);

const isCmbsProduct = (loanProductCode) =>
  CMBS_LOAN_CODES.has(loanProductCode);

const isAgencyMultifamilyProduct = (loanProductCode) =>
  AGENCY_MULTIFAMILY_LOAN_CODES.has(loanProductCode);

const isMezzanineProduct = (loanProductCode) =>
  MEZZANINE_LOAN_CODES.has(loanProductCode);

const isPreferredEquityProduct = (loanProductCode) =>
  PREFERRED_EQUITY_LOAN_CODES.has(loanProductCode);

const isSba7aGeneralProduct = (loanProductCode) =>
  SBA_7A_GENERAL_LOAN_CODES.has(loanProductCode);

const isSba7aBusinessAcquisitionProduct = (loanProductCode) =>
  SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES.has(loanProductCode);

const isSba7aWorkingCapitalProduct = (loanProductCode) =>
  SBA_7A_WORKING_CAPITAL_LOAN_CODES.has(loanProductCode);

const isSba7aEquipmentPurchaseProduct = (loanProductCode) =>
  SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES.has(loanProductCode);

const isSba7aRealEstateProduct = (loanProductCode) =>
  SBA_7A_REAL_ESTATE_LOAN_CODES.has(loanProductCode);

const isSbaExpressProduct = (loanProductCode) =>
  SBA_EXPRESS_LOAN_CODES.has(loanProductCode);

const isSba504Product = (loanProductCode) =>
  SBA_504_LOAN_CODES.has(loanProductCode);

const isUsdaBiProduct = (loanProductCode) =>
  USDA_BI_LOAN_CODES.has(loanProductCode);

const isCPaceProduct = (loanProductCode) =>
  C_PACE_LOAN_CODES.has(loanProductCode);

const isPurchaseOrderFinanceProduct = (loanProductCode) =>
  PURCHASE_ORDER_FINANCE_LOAN_CODES.has(loanProductCode);

const isEquipmentFinanceProduct = (loanProductCode) =>
  EQUIPMENT_FINANCE_LOAN_CODES.has(loanProductCode);

const isArFactoringProduct = (loanProductCode) =>
  INVOICE_FACTORING_LOAN_CODES.has(loanProductCode);

const isApSupplyChainProduct = (loanProductCode) =>
  ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES.has(loanProductCode);

const isSba7aMaxLoanOnlyProduct = (loanProductCode) =>
  isSba7aGeneralProduct(loanProductCode) ||
  isSba7aBusinessAcquisitionProduct(loanProductCode) ||
  isSba7aWorkingCapitalProduct(loanProductCode) ||
  isSba7aEquipmentPurchaseProduct(loanProductCode) ||
  isSba7aRealEstateProduct(loanProductCode) ||
  isSbaExpressProduct(loanProductCode);

const isNoMinLoanCriteriaProduct = (_loanProductCode) => false;

const isSba7aNoLtvProduct = (loanProductCode) =>
  isSba7aGeneralProduct(loanProductCode);

const isAnySba7aProduct = (loanProductCode) =>
  isSba7aMaxLoanOnlyProduct(loanProductCode);

const isAnySbaProduct = (loanProductCode) =>
  isAnySba7aProduct(loanProductCode) ||
  isSba504Product(loanProductCode) ||
  isSbaExpressProduct(loanProductCode);

const isNoLtvCriteriaProduct = (loanProductCode) =>
  isSba7aGeneralProduct(loanProductCode);

const isNoPropertyMetricsProduct = (loanProductCode) =>
  isSba7aGeneralProduct(loanProductCode) ||
  isArFactoringProduct(loanProductCode) ||
  isApSupplyChainProduct(loanProductCode) ||
  isPurchaseOrderFinanceProduct(loanProductCode);

const isNoTermCriteriaProduct = (loanProductCode) =>
  isPurchaseOrderFinanceProduct(loanProductCode) ||
  isArFactoringProduct(loanProductCode) ||
  isApSupplyChainProduct(loanProductCode);

const isSba7aRateSpreadProduct = (loanProductCode) =>
  isSba7aMaxLoanOnlyProduct(loanProductCode);

const usesYearTerms = (_loanProductCode) => false;

/**
 * Mirrors lending-dashboard loanProductCriteriaFields.ts — which criteria
 * apply per loan product when evaluating broker lender discovery.
 */
const getProductEligibilityRules = (productCode) => {
  const code = String(productCode || "");
  const noMinLoan = isNoMinLoanCriteriaProduct(code);
  const noPropertyMetrics = isNoPropertyMetricsProduct(code);
  const noTerm = isNoTermCriteriaProduct(code);

  return {
    checkMinLoanAmount:
      !noMinLoan ||
      isPurchaseOrderFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code),
    checkMaxLoanAmount: true,
    checkMaxTotalProjectAmount: false,
    checkMaxSba504DebentureAmount: false,
    checkTermMonths: !noTerm,
    checkCreditScore: true,
    checkLtv: !noPropertyMetrics,
    checkMezzLtv: isMezzanineProduct(code) || isPreferredEquityProduct(code),
    checkLtc:
      supportsLtcPercent(code) ||
      isDscrRentalProduct(code) ||
      isCrePermanentProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      isMezzanineProduct(code) ||
      isPreferredEquityProduct(code) ||
      isCmbsProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isEquipmentFinanceProduct(code),
    checkArv:
      isBridgeLoanProduct(code) ||
      isConstructionLoanProduct(code) ||
      (!isDscrRentalProduct(code) &&
        !isRentalPortfolioProduct(code) &&
        !isCrePermanentProduct(code) &&
        !isCmbsProduct(code) &&
        !isAgencyMultifamilyProduct(code) &&
        !isMezzanineProduct(code) &&
        !isPreferredEquityProduct(code) &&
        !isEquipmentFinanceProduct(code) &&
        !isArFactoringProduct(code) &&
        !isApSupplyChainProduct(code) &&
        !isPurchaseOrderFinanceProduct(code) &&
        !isCPaceProduct(code) &&
        !noPropertyMetrics),
    checkDscr:
      isBridgeLoanProduct(code) ||
      isDscrRentalProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isCrePermanentProduct(code) ||
      isCmbsProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      isMezzanineProduct(code) ||
      isPreferredEquityProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isPurchaseOrderFinanceProduct(code) ||
      isAnySba7aProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      isCPaceProduct(code),
    checkMinDebtYield:
      isCrePermanentProduct(code) ||
      isCmbsProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      isMezzanineProduct(code) ||
      isPreferredEquityProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isCPaceProduct(code),
    checkMinExperience:
      isBridgeLoanProduct(code) ||
      isDscrRentalProduct(code) ||
      isFixAndFlipProduct(code) ||
      isConstructionLoanProduct(code) ||
      isCrePermanentProduct(code) ||
      isAgencyMultifamilyProduct(code) ||
      isMezzanineProduct(code) ||
      isPreferredEquityProduct(code) ||
      isCmbsProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isPurchaseOrderFinanceProduct(code) ||
      isCPaceProduct(code) ||
      !noPropertyMetrics,
    checkFirstTimeBorrowers: isFixAndFlipProduct(code),
    checkMinUnits:
      isAgencyMultifamilyProduct(code) || isCrePermanentProduct(code),
    checkMaxUnits:
      isCrePermanentProduct(code) || isAgencyMultifamilyProduct(code),
    checkPortfolioProperties: isRentalPortfolioProduct(code),
    checkMinTimeInBusiness:
      isAnySba7aProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isPurchaseOrderFinanceProduct(code),
    checkStartupAllowed:
      isAnySba7aProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isPurchaseOrderFinanceProduct(code),
    checkMinAnnualRevenue:
      isSba7aWorkingCapitalProduct(code) ||
      isBridgeLoanProduct(code) ||
      isEquipmentFinanceProduct(code) ||
      isArFactoringProduct(code) ||
      isApSupplyChainProduct(code) ||
      isPurchaseOrderFinanceProduct(code) ||
      isSba7aRealEstateProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code),
    checkOwnerOccupied:
      isSba7aRealEstateProduct(code) ||
      isSba504Product(code) ||
      isUsdaBiProduct(code) ||
      isSbaExpressProduct(code) ||
      isSba7aEquipmentPurchaseProduct(code),
    checkRefinanceAllowed:
      isSba504Product(code) ||
      isSba7aRealEstateProduct(code) ||
      isUsdaBiProduct(code) ||
      isCPaceProduct(code),
    checkPropertyType: true,
    checkPropertyState: true,
    checkBusinessIndustry: isAnySbaProduct(code) || isUsdaBiProduct(code),
    checkInterestRate: !isSba7aRateSpreadProduct(code),
    usesYearTerms: usesYearTerms(code),
  };
};

module.exports = {
  BRIDGE_LOAN_CODES,
  FIX_AND_FLIP_CODES,
  DSCR_RENTAL_CODES,
  RENTAL_PORTFOLIO_CODES,
  CONSTRUCTION_LOAN_CODES,
  CRE_PERMANENT_LOAN_CODES,
  CMBS_LOAN_CODES,
  AGENCY_MULTIFAMILY_LOAN_CODES,
  MEZZANINE_LOAN_CODES,
  PREFERRED_EQUITY_LOAN_CODES,
  SBA_7A_GENERAL_LOAN_CODES,
  SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES,
  SBA_7A_WORKING_CAPITAL_LOAN_CODES,
  SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES,
  SBA_7A_REAL_ESTATE_LOAN_CODES,
  SBA_EXPRESS_LOAN_CODES,
  SBA_504_LOAN_CODES,
  USDA_BI_LOAN_CODES,
  C_PACE_LOAN_CODES,
  PURCHASE_ORDER_FINANCE_LOAN_CODES,
  EQUIPMENT_FINANCE_LOAN_CODES,
  INVOICE_FACTORING_LOAN_CODES,
  ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES,
  LTC_LOAN_CODES,
  supportsLtcPercent,
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
  isSba7aMaxLoanOnlyProduct,
  isAnySba7aProduct,
  isAnySbaProduct,
  isNoMinLoanCriteriaProduct,
  isSba7aNoLtvProduct,
  isNoLtvCriteriaProduct,
  isNoPropertyMetricsProduct,
  isNoTermCriteriaProduct,
  isSba7aRateSpreadProduct,
  usesYearTerms,
  getProductEligibilityRules,
};
