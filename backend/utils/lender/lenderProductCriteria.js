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

const SBA_504_LOAN_CODES = new Set([
  "SBA_504",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "SBA_504_REAL_ESTATE_EQUIPMENT",
]);

const USDA_BI_LOAN_CODES = new Set(["USDA_BI"]);

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
  ...FIX_AND_FLIP_CODES,
  ...BRIDGE_LOAN_CODES,
]);

const supportsLtcPercent = (loanProductCode) =>
  LTC_LOAN_CODES.has(loanProductCode);

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

const isSba504Product = (loanProductCode) =>
  SBA_504_LOAN_CODES.has(loanProductCode);

const isUsdaBiProduct = (loanProductCode) =>
  USDA_BI_LOAN_CODES.has(loanProductCode);

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
  isSba7aRealEstateProduct(loanProductCode);

const isNoMinLoanCriteriaProduct = (loanProductCode) =>
  isSba7aMaxLoanOnlyProduct(loanProductCode) ||
  isSba504Product(loanProductCode) ||
  isUsdaBiProduct(loanProductCode);

const isSba7aNoLtvProduct = (loanProductCode) =>
  isSba7aMaxLoanOnlyProduct(loanProductCode) &&
  !isSba7aRealEstateProduct(loanProductCode);

const isNoLtvCriteriaProduct = (loanProductCode) =>
  isSba7aNoLtvProduct(loanProductCode) || isUsdaBiProduct(loanProductCode);

const isNoPropertyMetricsProduct = (loanProductCode) =>
  isNoLtvCriteriaProduct(loanProductCode) ||
  isPurchaseOrderFinanceProduct(loanProductCode) ||
  isEquipmentFinanceProduct(loanProductCode) ||
  isArFactoringProduct(loanProductCode) ||
  isApSupplyChainProduct(loanProductCode);

const isNoTermCriteriaProduct = (loanProductCode) =>
  isPurchaseOrderFinanceProduct(loanProductCode) ||
  isArFactoringProduct(loanProductCode) ||
  isApSupplyChainProduct(loanProductCode);

const isSba7aRateSpreadProduct = (loanProductCode) =>
  isSba7aMaxLoanOnlyProduct(loanProductCode);

const usesYearTerms = (loanProductCode) =>
  isDscrRentalProduct(loanProductCode) ||
  isRentalPortfolioProduct(loanProductCode) ||
  isCrePermanentProduct(loanProductCode) ||
  isCmbsProduct(loanProductCode) ||
  isAgencyMultifamilyProduct(loanProductCode) ||
  isSba7aBusinessAcquisitionProduct(loanProductCode) ||
  isSba7aWorkingCapitalProduct(loanProductCode) ||
  isSba7aEquipmentPurchaseProduct(loanProductCode) ||
  isSba7aRealEstateProduct(loanProductCode) ||
  isSba504Product(loanProductCode) ||
  isUsdaBiProduct(loanProductCode);

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
    checkMaxLoanAmount: !isSba504Product(code),
    checkMaxTotalProjectAmount: isSba504Product(code),
    checkMaxSba504DebentureAmount: isSba504Product(code),
    checkTermMonths: !noTerm,
    checkCreditScore:
      !isPurchaseOrderFinanceProduct(code) &&
      !isArFactoringProduct(code) &&
      !isApSupplyChainProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code),
    checkLtv:
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !noPropertyMetrics,
    checkMezzLtv: isMezzanineProduct(code),
    checkLtc:
      supportsLtcPercent(code) &&
      !isDscrRentalProduct(code) &&
      !isRentalPortfolioProduct(code) &&
      !isCrePermanentProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code),
    checkArv:
      !isBridgeLoanProduct(code) &&
      !isDscrRentalProduct(code) &&
      !isRentalPortfolioProduct(code) &&
      !isConstructionLoanProduct(code) &&
      !isCrePermanentProduct(code) &&
      !isCmbsProduct(code) &&
      !isAgencyMultifamilyProduct(code) &&
      !isMezzanineProduct(code) &&
      !isPreferredEquityProduct(code) &&
      !noPropertyMetrics,
    checkDscr:
      isDscrRentalProduct(code) ||
      isRentalPortfolioProduct(code) ||
      isCrePermanentProduct(code) ||
      isCmbsProduct(code) ||
      isAgencyMultifamilyProduct(code),
    checkMinDebtYield: isCrePermanentProduct(code) || isCmbsProduct(code),
    checkMinExperience:
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
      !noPropertyMetrics,
    checkFirstTimeBorrowers: isFixAndFlipProduct(code),
    checkMinUnits: isAgencyMultifamilyProduct(code),
    checkPortfolioProperties: isRentalPortfolioProduct(code),
    checkMinTimeInBusiness: isSba7aWorkingCapitalProduct(code),
    checkPropertyType: true,
    checkPropertyState: true,
    checkBusinessIndustry: false,
    checkInterestRate:
      !isPreferredEquityProduct(code) &&
      !noMinLoan &&
      !isPurchaseOrderFinanceProduct(code) &&
      !isArFactoringProduct(code) &&
      !isApSupplyChainProduct(code),
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
  SBA_504_LOAN_CODES,
  USDA_BI_LOAN_CODES,
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
  isSba504Product,
  isUsdaBiProduct,
  isPurchaseOrderFinanceProduct,
  isEquipmentFinanceProduct,
  isArFactoringProduct,
  isApSupplyChainProduct,
  isSba7aMaxLoanOnlyProduct,
  isNoMinLoanCriteriaProduct,
  isSba7aNoLtvProduct,
  isNoLtvCriteriaProduct,
  isNoPropertyMetricsProduct,
  isNoTermCriteriaProduct,
  isSba7aRateSpreadProduct,
  usesYearTerms,
  getProductEligibilityRules,
};
