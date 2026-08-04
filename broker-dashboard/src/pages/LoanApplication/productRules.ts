// Product / purpose / flow predicate helpers. These are pure functions
// keyed off the loan product code, the loan purpose string, and/or the
// selected LoanCategory. They're the rules layer that decides which
// fields, dates, and steps to show in the form.

import {
  isSba7aAcquisitionProduct,
  isSbaRealEstateCollateralProduct,
  isSbaBase44Product,
} from "../../lib/sba7aAcquisition";
import {
  isAblBase44Product,
  isEquipmentFinanceProduct,
  showAblBase44PurchasePrice,
  showEquipmentFinanceMarketValue,
} from "../../lib/ablBase44";
// (isBase44BusinessCollateralProduct was previously imported here but is
// only referenced inside LoanApplication.tsx, so the import is no longer
// needed at this module level.)
import {
  CATEGORY_LOAN_TYPES,
  LOAN_PRODUCT_CODE_ALIASES,
} from "./constants";
import type { LoanCategory } from "./types";

/* ================= Alias helpers ================= */

export const getLoanProductAliasGroup = (code: string) =>
  LOAN_PRODUCT_CODE_ALIASES[code] || [code];

const catalogMatchesCategoryProduct = (
  catalogCode: string,
  allowedCode: string,
) => getLoanProductAliasGroup(allowedCode).includes(catalogCode);

/**
 * Pick one display/submit code per category slot.
 * Prefer the category's primary code when present in catalog, else an alias.
 */
export const resolveCategoryLoanProducts = (
  allowedProducts: string[],
  catalogCodes: string[],
) => {
  const catalogSet = new Set(catalogCodes);
  const claimed = new Set<string>();
  const resolved: string[] = [];

  for (const allowedCode of allowedProducts) {
    const group = getLoanProductAliasGroup(allowedCode);
    if (group.some((code) => claimed.has(code))) continue;

    const match =
      group.find((code) => catalogSet.has(code)) ||
      (catalogCodes.length === 0 ? allowedCode : null);

    if (!match) continue;

    resolved.push(match);
    group.forEach((code) => claimed.add(code));
  }

  return resolved;
};

export const isProductAllowedInCategory = (
  productCode: string,
  category: Exclude<LoanCategory, "">,
) => {
  const allowed = CATEGORY_LOAN_TYPES[category] || [];
  return allowed.some((allowedCode) =>
    catalogMatchesCategoryProduct(productCode, allowedCode),
  );
};

/* ================= Bridge loan predicates ================= */

const BRIDGE_LOAN_TYPES = new Set(["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"]);
const BRIDGE_PURCHASE_PURPOSE = "Purchase/Acquisition";
const BRIDGE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
]);
const BRIDGE_CONSTRUCTION_COMPLETION_PURPOSE = "Construction Completion";

export const isBridgePurchaseAcquisition = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) && purpose === BRIDGE_PURCHASE_PURPOSE;

export const isBridgeOriginalPurchaseDate = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) &&
  BRIDGE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isBridgeConstructionCompletion = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) &&
  purpose === BRIDGE_CONSTRUCTION_COMPLETION_PURPOSE;

export const isBridgeProduct = (product: string) => BRIDGE_LOAN_TYPES.has(product);

/* ================= Fix & flip predicates ================= */

const FIX_AND_FLIP_LOAN_TYPES = new Set(["FIX_AND_FLIP_LOAN_1_TO_4_UNITS"]);
const FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE = "Purchase & Rehab";
const FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE = "Refinance & Rehab";

export const isFixAndFlipPurchaseRehab = (product: string, purpose: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) &&
  purpose === FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE;

export const isFixAndFlipRefinanceRehab = (product: string, purpose: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) &&
  purpose === FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE;

export const isFixAndFlipProduct = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product);

/* ================= Amortization-with-purchase-date predicates ================= */

const PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "RENTAL_PORTFOLIO",
  "CRE_PERMANENT_LOAN",
  "AGENCY_LOAN_MULTIFAMILY",
  "CMBS",
  "SBA_7A_REAL_ESTATE",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "USDA_BI",
]);
const PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
  "Purchase",
  "Purchase/Acquisition",
  "Purchase / Acquisition",
  "Purchase (Owner-Occupied)",
  "Purchase & Rehab",
  "Real Estate Acquisition",
  "Business Acquisition",
  "Real Estate Purchase",
  "Equipment Purchase",
]);
const ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
  "Refinance",
  "Refinance & Rehab",
  "Refinance (504 Debt)",
  "Debt Refinancing",
]);

export const isPurchaseDateWithAmortization = (product: string, purpose: string) =>
  PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
  (PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose) ||
    ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose));

export const isOriginalPurchaseDateWithAmortization = (
  product: string,
  purpose: string,
) =>
  PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
  ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose);

/* ================= Construction loan predicates ================= */

const CONSTRUCTION_LOAN_TYPES = new Set([
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
]);

export const isConstructionLoanType = (product: string) =>
  CONSTRUCTION_LOAN_TYPES.has(product);

export const isConstructionLoanProduct = (product: string) =>
  product === "CONSTRUCTION_LOAN_1_TO_4_UNITS" ||
  product === "CONSTRUCTION_LOAN";

export const isConstruction14Product = (product: string) =>
  isConstructionLoanProduct(product);

/* ================= Mezzanine predicates ================= */

const MEZZANINE_LOAN_TYPES = new Set(["MEZZANINE_FINANCE"]);
const MEZZANINE_ACQUISITION_BRIDGE_PURPOSE = "Acquisition Bridge";

export const isMezzanineLoanType = (product: string) =>
  MEZZANINE_LOAN_TYPES.has(product);

export const isMezzanineAcquisitionBridge = (product: string, purpose: string) =>
  isMezzanineLoanType(product) &&
  purpose === MEZZANINE_ACQUISITION_BRIDGE_PURPOSE;

/* ================= SBA 7a predicates ================= */

const SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES = new Set([
  "Purchase/Acquisition",
  "Franchise Purchase",
]);

export const isSba7aAcquisitionPurchaseDate = (product: string, purpose: string) =>
  product === "SBA_7A_BUSINESS_ACQUISITION" &&
  SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aAcquisitionNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_BUSINESS_ACQUISITION" &&
  Boolean(purpose?.trim()) &&
  !SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

const SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES = new Set([
  "Inventory Purchase",
]);

const SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Debt Consolidation",
]);

export const isSba7aWorkingCapitalOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aWorkingCapitalLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  (SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES.has(purpose) ||
    SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isSba7aWorkingCapitalNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  Boolean(purpose?.trim()) &&
  !isSba7aWorkingCapitalLoanRequestDate(product, purpose);

const SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance Existing Equipment",
]);

export const isSba7aEquipmentOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aEquipmentLoanRequestDate = (product: string, purpose: string) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aEquipmentNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  Boolean(purpose?.trim()) &&
  !isSba7aEquipmentLoanRequestDate(product, purpose);

/* ================= Equipment Finance predicates ================= */

const EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES = new Set([
  "New Equipment Purchase",
  "Used Equipment Purchase",
]);

const EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance/Consolidation",
]);

export const isEquipmentFinanceOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "EQUIPMENT_FINANCE" &&
  EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isEquipmentFinanceLoanRequestDate = (product: string, purpose: string) =>
  product === "EQUIPMENT_FINANCE" &&
  (EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isEquipmentFinanceNonPurchase = (product: string, purpose: string) =>
  product === "EQUIPMENT_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isEquipmentFinanceLoanRequestDate(product, purpose);

/* ================= Purchase Order Finance predicates ================= */

const PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

export const isPurchaseOrderFinanceLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  product === "PURCHASE_ORDER_FINANCE" &&
  (PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isPurchaseOrderFinanceNonPurchase = (product: string, purpose: string) =>
  product === "PURCHASE_ORDER_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isPurchaseOrderFinanceLoanRequestDate(product, purpose);

/* ================= Accounts Receivable predicates ================= */

const ACCOUNTS_RECEIVABLE_LOAN_TYPES = new Set([
  "ACCOUNTS_RECEIVABLE_FINANCE",
  "ACCOUNTS_RECEIVABLE",
]);

const ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

export const isAccountsReceivableLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
  (ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isAccountsReceivableNonPurchase = (product: string, purpose: string) =>
  ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
  Boolean(purpose?.trim()) &&
  !isAccountsReceivableLoanRequestDate(product, purpose);

/* ================= Accounts Payable predicates ================= */

const ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

export const isAccountsPayableLoanRequestDate = (product: string, purpose: string) =>
  product === "ACCOUNTS_PAYABLE_FINANCE" &&
  (ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isAccountsPayableNonPurchase = (product: string, purpose: string) =>
  product === "ACCOUNTS_PAYABLE_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isAccountsPayableLoanRequestDate(product, purpose);

/* ================= Hide-amortization aggregator ================= */

export const hidesLoanRequestAmortization = (product: string, purpose: string) =>
  isBridgeConstructionCompletion(product, purpose) ||
  isConstructionLoanType(product) ||
  (isMezzanineLoanType(product) &&
    !isMezzanineAcquisitionBridge(product, purpose)) ||
  isSba7aAcquisitionNonPurchase(product, purpose) ||
  isSba7aWorkingCapitalNonPurchase(product, purpose) ||
  isSba7aEquipmentNonPurchase(product, purpose) ||
  isEquipmentFinanceNonPurchase(product, purpose) ||
  isPurchaseOrderFinanceNonPurchase(product, purpose) ||
  isAccountsReceivableNonPurchase(product, purpose) ||
  isAccountsPayableNonPurchase(product, purpose);

/* ================= CRE-specific predicates ================= */

export const isCrePermanentRecapitalization = (product: string, purpose: string) =>
  product === "CRE_PERMANENT_LOAN" && purpose === "Recapitalization";

const AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES = new Set([
  "Affordable Housing",
  "Supplement Loan",
]);

export const isAgencyMultifamilyNoPurchaseDate = (product: string, purpose: string) =>
  product === "AGENCY_LOAN_MULTIFAMILY" &&
  AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES.has(purpose);

/* ================= Composite loan-request-date predicates ================= */

export const isLoanRequestOriginalPurchaseDate = (product: string, purpose: string) =>
  isBridgeOriginalPurchaseDate(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  isOriginalPurchaseDateWithAmortization(product, purpose) ||
  isSba7aWorkingCapitalOriginalPurchaseDate(product, purpose) ||
  isSba7aEquipmentOriginalPurchaseDate(product, purpose) ||
  isEquipmentFinanceOriginalPurchaseDate(product, purpose);

export const isBridgeLoanRequestDateField = (product: string, purpose: string) =>
  isBridgePurchaseAcquisition(product, purpose) ||
  isBridgeOriginalPurchaseDate(product, purpose);

export const isLoanRequestPurchaseDateReplacesAmortization = (
  product: string,
  purpose: string,
) =>
  isBridgeLoanRequestDateField(product, purpose) ||
  isFixAndFlipPurchaseRehab(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  isMezzanineAcquisitionBridge(product, purpose) ||
  isSba7aAcquisitionPurchaseDate(product, purpose) ||
  isSba7aWorkingCapitalLoanRequestDate(product, purpose) ||
  isSba7aEquipmentLoanRequestDate(product, purpose) ||
  isEquipmentFinanceLoanRequestDate(product, purpose);

export const isLoanRequestPurchaseDateField = (product: string, purpose: string) =>
  isLoanRequestPurchaseDateReplacesAmortization(product, purpose) ||
  isPurchaseDateWithAmortization(product, purpose);

export const shouldHidePropertyPurchaseDate = (product: string, purpose: string) =>
  isLoanRequestPurchaseDateField(product, purpose) ||
  hidesLoanRequestAmortization(product, purpose) ||
  isCrePermanentRecapitalization(product, purpose) ||
  isAgencyMultifamilyNoPurchaseDate(product, purpose);

export const getLoanRequestPurchaseDateLabel = (product: string, purpose: string) =>
  isLoanRequestOriginalPurchaseDate(product, purpose)
    ? "Original Purchase Date"
    : "Purchase Date";

/* ================= Residential 1-4 family predicates ================= */

const RESIDENTIAL_PURCHASE_PRICE_PURPOSES = new Set([
  "Purchase/Acquisition",
  "Purchase & Rehab",
  "Purchase",
  "Portfolio Blanket",
]);

const RESIDENTIAL_MARKET_VALUE_PURPOSES = new Set([
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
  "Refinance & Rehab",
  "Refinance",
]);

export const isResidential14Category = (category: LoanCategory) =>
  category === "RESIDENTIAL_1_4";

/** CRE & Multifamily products that share the same field rules as 1-4 residential. */
const CRE_RESIDENTIAL_LIKE_LOAN_TYPES = new Set([
  "BRIDGE_LOAN",
  "BRIDGE_LOAN_1_TO_4_UNITS",
  "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
  "DSCR_LOAN_1_TO_4_UNITS",
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
  "RENTAL_PORTFOLIO",
]);

export const isCreResidentialLikeCategoryProduct = (
  category: LoanCategory,
  product: string,
) =>
  category === "CRE_MULTIFAMILY" &&
  CRE_RESIDENTIAL_LIKE_LOAN_TYPES.has(product);

/* ================= CRE base44 predicates ================= */

const CRE_PERMANENT_LOAN_TYPE = "CRE_PERMANENT_LOAN";
const AGENCY_MULTIFAMILY_LOAN_TYPE = "AGENCY_LOAN_MULTIFAMILY";
const CMBS_LOAN_TYPE = "CMBS";
const MEZZANINE_FINANCE_LOAN_TYPE = "MEZZANINE_FINANCE";

const CRE_BASE44_LOAN_TYPES = new Set([
  CRE_PERMANENT_LOAN_TYPE,
  AGENCY_MULTIFAMILY_LOAN_TYPE,
  CMBS_LOAN_TYPE,
  MEZZANINE_FINANCE_LOAN_TYPE,
]);

const CRE_BASE44_EBITDA_LOAN_TYPES = new Set([
  CRE_PERMANENT_LOAN_TYPE,
  AGENCY_MULTIFAMILY_LOAN_TYPE,
  CMBS_LOAN_TYPE,
]);

export const isCrePermanentProduct = (product: string) =>
  product === CRE_PERMANENT_LOAN_TYPE;

export const isAgencyMultifamilyProduct = (product: string) =>
  product === AGENCY_MULTIFAMILY_LOAN_TYPE;

export const isCreBase44Product = (product: string) =>
  CRE_BASE44_LOAN_TYPES.has(product);

export const showCreBase44EntityEbitda = (product: string) =>
  CRE_BASE44_EBITDA_LOAN_TYPES.has(product);

/* ================= Rental portfolio predicates ================= */

const RENTAL_PORTFOLIO_LOAN_TYPES = new Set(["RENTAL_PORTFOLIO"]);
const RENTAL_UNDERWRITING_LOAN_TYPES = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "RENTAL_PORTFOLIO",
]);

export const isRentalPortfolioProduct = (product: string) =>
  RENTAL_PORTFOLIO_LOAN_TYPES.has(product);

export const isRentalUnderwritingProduct = (product: string) =>
  RENTAL_UNDERWRITING_LOAN_TYPES.has(product);

/* ================= Show-property-field predicates ================= */

export const showResidentialPropertyPurchasePrice = (
  product: string,
  purpose: string,
) =>
  RESIDENTIAL_PURCHASE_PRICE_PURPOSES.has(purpose) ||
  isBridgePurchaseAcquisition(product, purpose) ||
  isFixAndFlipPurchaseRehab(product, purpose) ||
  isConstructionLoanProduct(product) ||
  isMezzanineLoanType(product) ||
  isSba7aAcquisitionProduct(product) ||
  showAblBase44PurchasePrice(product, purpose) ||
  isSbaRealEstateCollateralProduct(product) ||
  (isCreBase44Product(product) && purpose === "Purchase/Acquisition");

export const showResidentialPropertyConstructionCost = (product: string) =>
  isConstructionLoanProduct(product);

export const showResidentialPropertyMarketValue = (product: string, purpose: string) =>
  RESIDENTIAL_MARKET_VALUE_PURPOSES.has(purpose) ||
  isBridgeOriginalPurchaseDate(product, purpose) ||
  isBridgeConstructionCompletion(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  (isCrePermanentProduct(product) && purpose === "Recapitalization") ||
  (isAgencyMultifamilyProduct(product) &&
    (purpose === "Affordable Housing" || purpose === "Supplement Loan")) ||
  (isSbaRealEstateCollateralProduct(product) &&
    (purpose === "Refinance" ||
      purpose === "Refinance & Rehab" ||
      purpose === "Refinance (504 Debt)" ||
      purpose === "Debt Refinancing")) ||
  (isEquipmentFinanceProduct(product) &&
    showEquipmentFinanceMarketValue(purpose));

export const showResidentialPropertyArv = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) || isConstructionLoanProduct(product);

export const showResidentialPropertyRehabCost = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product);

/** "Equity / Down Payment" block: visible for purchase-related purposes. */
export const showEquityDownPaymentBlock = (product: string, purpose: string) => {
  if (!purpose) return true; // default visible when nothing selected
  // console.log(product);
  // console.log(purpose);
  if ((purpose == "Portfolio Blanket")) {
    return false
  }
  if ((product === "MEZZANINE_FINANCE" && purpose === "Leverage Enhancement") ||
    (product === "MEZZANINE_FINANCE" && purpose === "JV Equity") ||
    (product === "MEZZANINE_FINANCE" && purpose === "Construction Project") ||
    (product === "SBA_7A_WORKING_CAPITAL" && purpose === "Inventory Purchase") ||
    (product === "SBA_7A_REAL_ESTATE" && purpose === "Purchase (Owner-Occupied)") ||
    (product === "SBA_504_REAL_ESTATE_AND_EQUIPMENT" && purpose === "Real Estate Acquisition") ||
    (product === "USDA_BI" && purpose === "Business Acquisition") ||
    (product === "USDA_BI" && purpose === "Real Estate Purchase") ||
    (product === "USDA_BI" && purpose === "Equipment Purchase") ||
    (product === "EQUIPMENT_FINANCE" && purpose === "New Equipment Purchase") ||
    (product === "EQUIPMENT_FINANCE" && purpose === "Used Equipment Purchase")
  ) {
    return true;
  }

  return (
    RESIDENTIAL_PURCHASE_PRICE_PURPOSES.has(purpose) ||
    isBridgePurchaseAcquisition(product, purpose) ||
    isFixAndFlipPurchaseRehab(product, purpose) ||
    isMezzanineAcquisitionBridge(product, purpose) ||
    isConstructionLoanProduct(product)
  );
};

/** "Valuation & Equity" block: visible for refinance-style purposes. */
export const showValuationEquityBlock = (product: string, purpose: string) => {
  if (!purpose) return false;
  // console.log(product);
  // console.log(purpose);
  if (
    (purpose === "Construction Completion") ||
    (purpose === "Portfolio Blanket") ||
    (purpose === "Recapitalization") ||
    (purpose === "Affordable Housing") ||
    (purpose === "Supplement Loan")
  ) {
    return false;
  }




  return (
    RESIDENTIAL_MARKET_VALUE_PURPOSES.has(purpose) ||
    isBridgeOriginalPurchaseDate(product, purpose) ||
    isFixAndFlipRefinanceRehab(product, purpose) ||
    (isCrePermanentProduct(product) && purpose === "Recapitalization") ||
    (isAgencyMultifamilyProduct(product) &&
      (purpose === "Affordable Housing" || purpose === "Supplement Loan")) ||
    (isSbaRealEstateCollateralProduct(product) &&
      (purpose === "Refinance" ||
        purpose === "Refinance & Rehab" ||
        purpose === "Refinance (504 Debt)" ||
        purpose === "Debt Refinancing")) ||
    (isEquipmentFinanceProduct(product) &&
      showEquipmentFinanceMarketValue(purpose))
  );
};

/* ================= Cross-flow composite predicates ================= */

// Re-export so callers can do `isSbaBase44Product` from this module.
export { isSbaBase44Product };

export const isBase44CollateralStep = (
  category: LoanCategory,
  product: string,
  isCreResidentialLikeFlow: boolean,
) =>
  isResidential14Category(category) ||
  isCreResidentialLikeFlow ||
  (category === "CRE_MULTIFAMILY" && isCreBase44Product(product)) ||
  (category === "SBA_USDA" && isSbaBase44Product(product)) ||
  (category === "ABL" && isAblBase44Product(product));

/* ================= Exit-strategy visibility ================= */

const HIDE_EXIT_STRATEGY_PRODUCTS = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "RENTAL_PORTFOLIO",
  "CRE_PERMANENT_LOAN",
  "AGENCY_LOAN_MULTIFAMILY",
  "CMBS",
]);

const HIDE_EXIT_STRATEGY_CATEGORIES = new Set(["SBA_USDA", "ABL"]);

/**
 * "Exit strategy" textarea is hidden for long-hold product families
 * (DSCR/Rental/CRE-Permanent/Agency/CMBS) and for SBA/ABL categories.
 */
export const showExitStrategy = (product: string, category: string) =>
  !HIDE_EXIT_STRATEGY_PRODUCTS.has(product) &&
  !HIDE_EXIT_STRATEGY_CATEGORIES.has(category);
