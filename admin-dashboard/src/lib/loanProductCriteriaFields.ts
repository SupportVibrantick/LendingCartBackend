import { resolveLenderOfferedProductCode } from "./canonicalLoanProducts";

export const BRIDGE_LOAN_CODES = new Set([
  "BRIDGE_LOAN",
  "BRIDGE_LOAN_1_TO_4_UNITS",
  "BRIDGE",
]);

export const FIX_AND_FLIP_CODES = new Set([
  "FIX_AND_FLIP",
  "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
]);

export const LTC_LOAN_CODES = new Set([
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
export type CriteriaFieldType =
  | "number"
  | "toggle"
  | "textarea"
  | "text"
  | "choice";

export type CriteriaFieldOption = {
  label: string;
  value: string;
};

export type CriteriaField = {
  label: string;
  key: string;
  type?: CriteriaFieldType;
  required?: boolean;
  /** Term inputs stored as months in API; display unit in the form */
  termUnit?: "years" | "months";
  /** Allow decimal values (e.g. Min DSCR, rate spreads) */
  decimal?: boolean;
  /** Suffix shown inside the input on the right (e.g. %, x) */
  inputSuffix?: string;
  /** Optional helper text shown under the label */
  helperText?: string;
  /** Choice options (Fannie / Freddie / Both, etc.) */
  options?: CriteriaFieldOption[];
  /** Only show for these product codes */
  products?: string[];
  /** Hide for these product codes */
  excludeProducts?: string[];
};

export const DSCR_RENTAL_CODES = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "DSCR",
  "DSCR_RENTAL",
]);

export const RENTAL_PORTFOLIO_CODES = new Set(["RENTAL_PORTFOLIO"]);

export const CONSTRUCTION_LOAN_CODES = new Set([
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
  "CONSTRUCTION",
  "GROUND_UP_CONSTRUCTION",
  "CONSTRUCTION_TO_PERM",
  "COMMERCIAL_CONSTRUCTION",
]);

export const CRE_PERMANENT_LOAN_CODES = new Set(["CRE_PERMANENT_LOAN"]);

export const CMBS_LOAN_CODES = new Set(["CMBS"]);

export const AGENCY_MULTIFAMILY_LOAN_CODES = new Set(["AGENCY_LOAN_MULTIFAMILY"]);

export const MEZZANINE_LOAN_CODES = new Set([
  "MEZZANINE_FINANCE",
  "MEZZ_FINANCE",
]);

export const PREFERRED_EQUITY_LOAN_CODES = new Set([
  "PREFERRED_EQUITY",
  "MEZZ_FINANCE_PREF_EQUITY",
]);

export const SBA_7A_GENERAL_LOAN_CODES = new Set(["SBA_7A"]);

export const SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES = new Set([
  "SBA_7A_BUSINESS_ACQUISITION",
]);

export const SBA_7A_WORKING_CAPITAL_LOAN_CODES = new Set([
  "SBA_7A_WORKING_CAPITAL",
]);

export const SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES = new Set([
  "SBA_7A_EQUIPMENT_PURCHASE",
]);

export const SBA_7A_REAL_ESTATE_LOAN_CODES = new Set(["SBA_7A_REAL_ESTATE"]);

export const SBA_EXPRESS_LOAN_CODES = new Set(["SBA_EXPRESS"]);

export const SBA_504_LOAN_CODES = new Set([
  "SBA_504",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "SBA_504_REAL_ESTATE_EQUIPMENT",
]);

export const USDA_BI_LOAN_CODES = new Set(["USDA_BI"]);

export const C_PACE_LOAN_CODES = new Set(["C_PACE"]);

export const PURCHASE_ORDER_FINANCE_LOAN_CODES = new Set([
  "PURCHASE_ORDER_FINANCE",
]);

export const EQUIPMENT_FINANCE_LOAN_CODES = new Set(["EQUIPMENT_FINANCE"]);

export const INVOICE_FACTORING_LOAN_CODES = new Set(["INVOICE_FACTORING"]);

export const ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES = new Set([
  "ACCOUNTS_PAYABLE_FINANCE",
]);

/** Shown first for every loan product in StepFive criteria forms. */
export const UNIVERSAL_LOAN_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
];

const RATE_CRITERIA_KEYS = new Set([
  "minRate",
  "maxRate",
  "minRateSpread",
  "maxRateSpread",
  "interestRateNote",
]);

const UNIVERSAL_CRITERIA_KEYS = new Set(
  UNIVERSAL_LOAN_CRITERIA_FIELDS.map((field) => field.key),
);

const PERCENTAGE_FIELD_KEYS = new Set([
  "minLtv",
  "maxLtv",
  "maxLtc",
  "maxArv",
  "maxLtvCashOut",
  "minRate",
  "maxRate",
  "minRateSpread",
  "maxRateSpread",
  "originationPoints",
  "requiredInjection",
  "sbaGuaranteePercent",
  "maxFinancingPercent",
  "rehabFundsMaxPercent",
  "mezzLtvMin",
  "mezzLtvMax",
  "minDebtYield",
  "minOccupancy",
  "exitFee",
  "preferredReturn",
  "usdaGuaranteePercent",
  "advanceRate",
  "minAdvanceRate",
  "maxAdvanceRate",
  "transactionFee",
  "minGrossMargin",
  "discountFee",
  "concentrationLimit",
  "maxInvoiceDilution",
  "maxArConcentration",
  "maxVendorConcentration",
  "maxPayablesConcentration",
  "maxCustomerConcentration",
  "minGrossProfitMargin",
  "minCustomerDeposit",
  "maxPoConcentration",
  "earlyPaymentDiscount",
]);

export const getProductRateCriteriaFields = (
  _productCode: string,
): CriteriaField[] => {
  return [];
};

export const getCriteriaFieldInputSuffix = (
  field: CriteriaField,
): string | null => {
  if (field.inputSuffix) {
    return field.inputSuffix;
  }

  if (field.key === "minDscr" || field.key === "preferredDscr") {
    return "x";
  }

  if (PERCENTAGE_FIELD_KEYS.has(field.key) || field.label.includes("(%)")) {
    return "%";
  }

  if (field.label.includes("(Years)")) {
    return "yr";
  }

  if (
    field.label.includes("(months)") ||
    field.label.includes("(Months)")
  ) {
    return "mo";
  }

  if (field.label.includes("(days)")) {
    return "days";
  }

  return null;
};

const HIDDEN_CRITERIA_KEYS = new Set(["minLtv", "minRateSpread", "maxRateSpread"]);

const productSkipsUniversalField = (
  productCode: string,
  fieldKey: string,
): boolean => {
  if (isSba7aGeneralProduct(productCode) && fieldKey === "maxLtv") {
    return true;
  }

  // Mezzanine stores LTV in minMezzLtvPercent / maxMezzLtvPercent (mezzLtvMin / mezzLtvMax).
  if (
    isMezzanineProduct(productCode) &&
    (fieldKey === "maxLtv" || fieldKey === "maxLtc")
  ) {
    return true;
  }

  if (isArFactoringProduct(productCode)) {
    if (
      fieldKey === "minRate" ||
      fieldKey === "maxRate" ||
      fieldKey === "maxLtc"
    ) {
      return true;
    }
  }

  if (
    isPreferredEquityProduct(productCode) &&
    (fieldKey === "minRate" || fieldKey === "maxRate")
  ) {
    return true;
  }

  return false;
};

const getUniversalFieldsForProduct = (productCode: string): CriteriaField[] =>
  UNIVERSAL_LOAN_CRITERIA_FIELDS.filter(
    (field) => !productSkipsUniversalField(productCode, field.key),
  );

const mergeWithUniversalCriteriaFields = (
  productCode: string,
  productFields: CriteriaField[],
): CriteriaField[] => {
  const universalFields = getUniversalFieldsForProduct(productCode);
  const excludedKeys = new Set([
    ...UNIVERSAL_CRITERIA_KEYS,
    ...RATE_CRITERIA_KEYS,
  ]);

  const additionalFields = productFields.filter(
    (field) =>
      !excludedKeys.has(field.key) && !HIDDEN_CRITERIA_KEYS.has(field.key),
  );

  const rateFields = getProductRateCriteriaFields(productCode).filter(
    (field) => !HIDDEN_CRITERIA_KEYS.has(field.key),
  );

  return [...universalFields, ...rateFields, ...additionalFields];
};

const DEFAULT_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  {
    label: "Max ARV (%)",
    key: "maxArv",
    required: true,
    excludeProducts: [...BRIDGE_LOAN_CODES],
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    products: [...LTC_LOAN_CODES],
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Min Experience (Years)",
    key: "experience",
    required: true,
    excludeProducts: [
      ...BRIDGE_LOAN_CODES,
      ...FIX_AND_FLIP_CODES,
      ...DSCR_RENTAL_CODES,
      ...RENTAL_PORTFOLIO_CODES,
      ...CONSTRUCTION_LOAN_CODES,
      ...CRE_PERMANENT_LOAN_CODES,
      ...CMBS_LOAN_CODES,
      ...AGENCY_MULTIFAMILY_LOAN_CODES,
      ...MEZZANINE_LOAN_CODES,
      ...PREFERRED_EQUITY_LOAN_CODES,
      ...SBA_7A_GENERAL_LOAN_CODES,
      ...SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES,
      ...SBA_7A_WORKING_CAPITAL_LOAN_CODES,
      ...SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES,
      ...SBA_7A_REAL_ESTATE_LOAN_CODES,
      ...SBA_EXPRESS_LOAN_CODES,
      ...SBA_504_LOAN_CODES,
      ...USDA_BI_LOAN_CODES,
      ...C_PACE_LOAN_CODES,
      ...PURCHASE_ORDER_FINANCE_LOAN_CODES,
      ...EQUIPMENT_FINANCE_LOAN_CODES,
      ...INVOICE_FACTORING_LOAN_CODES,
      ...ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES,
    ],
  },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
];

const bridgeToggle = (label: string, key: string): CriteriaField => ({
  label,
  key,
  type: "toggle",
  required: false,
});

const BRIDGE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTARV (%)",
    key: "maxArv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  {
    label: "Property Value – Min ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Property Value – Max ($)",
    key: "maxPropertyValue",
    required: true,
  },
  bridgeToggle("1 Unit", "unit1Allowed"),
  bridgeToggle("2 Units", "unit2Allowed"),
  bridgeToggle("3 Units", "unit3Allowed"),
  bridgeToggle("4 Units", "unit4Allowed"),
  bridgeToggle("Owner-Occupied", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Refinance", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Renovation Allowed", "renovationAllowed"),
  bridgeToggle("Heavy Rehab", "heavyRehabAllowed"),
  bridgeToggle("Light Rehab", "lightRehabAllowed"),
  bridgeToggle("Vacant Property", "vacantPropertyAllowed"),
  bridgeToggle("Tenant Occupied", "tenantOccupiedAllowed"),
  bridgeToggle("Short-Term Rental / Airbnb", "shortTermRentalsOk"),
  bridgeToggle("Foreclosure / REO", "foreclosureReoAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Prepayment Penalty", "prepaymentPenalty"),
  bridgeToggle("Interest-Only Payments", "interestOnlyAvailable"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const FIX_AND_FLIP_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTARV (%)",
    key: "maxArv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Investor Experience (Deals)",
    key: "minInvestorExperienceDeals",
    required: true,
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("1 Unit", "unit1Allowed"),
  bridgeToggle("2 Units", "unit2Allowed"),
  bridgeToggle("3 Units", "unit3Allowed"),
  bridgeToggle("4 Units", "unit4Allowed"),
  bridgeToggle("Owner-Occupied", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Refinance", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Light Rehab", "lightRehabAllowed"),
  bridgeToggle("Moderate Rehab", "moderateRehabAllowed"),
  bridgeToggle("Heavy Rehab", "heavyRehabAllowed"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Vacant Property", "vacantPropertyAllowed"),
  bridgeToggle("Foreclosure / REO", "foreclosureReoAllowed"),
  bridgeToggle("Short Sale", "shortSaleAllowed"),
  bridgeToggle("Borrower Experience Required", "borrowerExperienceRequired"),
  bridgeToggle("First-Time Investor", "firstTimeInvestorAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Rehab Funds Financed", "rehabFundsFinanced"),
  {
    label: "Rehab Funds – Max (%)",
    key: "rehabFundsMaxPercent",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  bridgeToggle("Draw Schedule", "drawScheduleRequired"),
  bridgeToggle("Prepayment Penalty", "prepaymentPenalty"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const DSCR_RENTAL_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV – Cash-Out Refinance (%)",
    key: "maxLtvCashOut",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("1 Unit", "unit1Allowed"),
  bridgeToggle("2 Units", "unit2Allowed"),
  bridgeToggle("3 Units", "unit3Allowed"),
  bridgeToggle("4 Units", "unit4Allowed"),
  bridgeToggle("Owner-Occupied", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Rate & Term Refinance", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  {
    label: "Minimum Rental Income ($)",
    key: "minRentalIncome",
    required: true,
  },
  bridgeToggle("Rental Income Required", "rentalIncomeRequired"),
  bridgeToggle("Short-Term Rental / Airbnb", "shortTermRentalsOk"),
  bridgeToggle("Long-Term Rental", "longTermRentalAllowed"),
  bridgeToggle("Vacant Property", "vacantPropertyAllowed"),
  bridgeToggle("Lease Required", "leaseRequired"),
  bridgeToggle("Market Rent / Rent Schedule Accepted", "marketRentScheduleAccepted"),
  bridgeToggle("LLC / Entity Vesting", "llcEntityBorrowerAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("First-Time Investor", "firstTimeInvestorAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Foreclosure / Short Sale", "foreclosureShortSaleAllowed"),
  bridgeToggle("Prepayment Penalty", "prepaymentPenalty"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const RENTAL_PORTFOLIO_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Investor Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Amortization (Months)",
    key: "amortizationMonths",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Rate & Term Refinance", "rateTermRefinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Portfolio Refinance", "portfolioRefinanceAllowed"),
  bridgeToggle("Cross-Collateralization", "crossCollateralizationAllowed"),
  bridgeToggle("1–4 Unit Properties", "residential1To4Allowed"),
  bridgeToggle("Multifamily 5+ Units", "multifamily5PlusAllowed"),
  {
    label: "Minimum Properties in Portfolio",
    key: "minProperties",
    required: true,
  },
  {
    label: "Maximum Properties in Portfolio",
    key: "maxProperties",
    required: true,
  },
  {
    label: "Minimum Portfolio Value ($)",
    key: "minPortfolioValue",
    required: true,
  },
  {
    label: "Maximum Portfolio Value ($)",
    key: "maxPortfolioValue",
    required: true,
  },
  {
    label: "Minimum Property Value ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Maximum Property Value ($)",
    key: "maxPropertyValue",
    required: true,
  },
  {
    label: "Minimum Portfolio NOI ($)",
    key: "minPortfolioNoi",
    required: true,
  },
  {
    label: "Minimum Portfolio Rental Income ($)",
    key: "minPortfolioRentalIncome",
    required: true,
  },
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  bridgeToggle("Long-Term Rental", "longTermRentalAllowed"),
  bridgeToggle("Short-Term Rental / Airbnb", "shortTermRentalsOk"),
  bridgeToggle("Owner-Occupied Properties", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Vacant Properties", "vacantPropertyAllowed"),
  bridgeToggle("Light Rehab", "lightRehabAllowed"),
  bridgeToggle("Value-Add Properties", "valueAddPropertiesAccepted"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("First-Time Investor", "firstTimeInvestorAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Foreclosure / Short Sale", "foreclosureShortSaleAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  {
    label: "Minimum Cash Reserves ($)",
    key: "minCashReserves",
    required: true,
  },
  {
    label: "Minimum Months Reserves",
    key: "minMonthsReserves",
    required: true,
  },
  bridgeToggle("Lease Required", "leaseRequired"),
  bridgeToggle("Market Rent Accepted", "marketRentScheduleAccepted"),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle(
    "Property Condition Assessment",
    "propertyConditionAssessmentRequired",
  ),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const CONSTRUCTION_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTARV (%)",
    key: "maxArv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Builder Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Construction Projects Completed",
    key: "minConstructionProjectsCompleted",
    required: true,
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only During Construction", "interestOnlyAvailable"),
  bridgeToggle("1 Unit", "unit1Allowed"),
  bridgeToggle("2 Units", "unit2Allowed"),
  bridgeToggle("3 Units", "unit3Allowed"),
  bridgeToggle("4 Units", "unit4Allowed"),
  bridgeToggle("Owner-Occupied", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Tear-Down / Rebuild", "tearDownRebuildAllowed"),
  bridgeToggle("Major Renovation", "majorRenovationAllowed"),
  bridgeToggle("Construction-to-Permanent", "constructionToPermanentAllowed"),
  bridgeToggle("Lot/Land Purchase Included", "lotPurchaseIncluded"),
  bridgeToggle("Land Already Owned", "landAlreadyOwnedAllowed"),
  bridgeToggle("Land Equity Allowed", "landEquityAllowed"),
  bridgeToggle("Soft Costs Financed", "softCostsFinanced"),
  bridgeToggle("Hard Costs Financed", "hardCostsFinanced"),
  bridgeToggle("Contingency Financed", "contingencyFinanced"),
  bridgeToggle("Interest Reserve Financed", "interestReserveFinanced"),
  bridgeToggle("Builder/GC Required", "gcRequired"),
  bridgeToggle("Owner-Builder Allowed", "ownerBuilderAllowed"),
  bridgeToggle("First-Time Builder", "firstTimeBuilderAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Draw Schedule", "drawScheduleRequired"),
  bridgeToggle("Inspection Required for Draws", "inspectionRequiredForDraws"),
  bridgeToggle("Prepayment Penalty", "prepaymentPenalty"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const CRE_PERMANENT_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Property Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Ownership Experience (Years)",
    key: "minOwnershipExperienceYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Amortization (Months)",
    key: "amortizationMonths",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Rate & Term Refinance", "rateTermRefinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Owner-Occupied", "ownerOccupiedAllowed"),
  bridgeToggle("Non-Owner Occupied", "nonOwnerOccupiedAllowed"),
  bridgeToggle("Multifamily – 5+ Units", "multifamily5PlusAllowed"),
  bridgeToggle("Apartment", "apartmentAllowed"),
  bridgeToggle("Office", "officeAllowed"),
  bridgeToggle("Retail", "retailAllowed"),
  bridgeToggle("Industrial", "industrialAllowed"),
  bridgeToggle("Mixed-Use", "mixedUseAllowed"),
  bridgeToggle("Self-Storage", "selfStorageAllowed"),
  bridgeToggle("Hotel / Hospitality", "hotelHospitalityAllowed"),
  bridgeToggle("Medical / Healthcare", "medicalHealthcareAllowed"),
  bridgeToggle("Student Housing", "studentHousingAllowed"),
  bridgeToggle("Mobile Home Park", "mobileHomeParkAllowed"),
  bridgeToggle("Senior Housing", "seniorHousingAllowed"),
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Minimum Property Value ($)", key: "minPropertyValue", required: true },
  { label: "Maximum Property Value ($)", key: "maxPropertyValue", required: true },
  { label: "Minimum Annual NOI ($)", key: "minAnnualNoi", required: true },
  { label: "Minimum Units – Multifamily", key: "minUnits", required: true },
  { label: "Maximum Units – Multifamily", key: "maxUnits", required: true },
  bridgeToggle("Stabilized Property Required", "stabilizedPropertyRequired"),
  bridgeToggle("Lease-Up Properties Accepted", "leaseUpPropertiesAccepted"),
  bridgeToggle("Value-Add Properties Accepted", "valueAddPropertiesAccepted"),
  bridgeToggle("Newly Renovated Properties", "newlyRenovatedPropertiesAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle(
    "Property Condition Assessment Required",
    "propertyConditionAssessmentRequired",
  ),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const CMBS_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Property Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Ownership Experience (Years)",
    key: "minOwnershipExperienceYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Amortization (Months)",
    key: "amortizationMonths",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Rate & Term Refinance", "rateTermRefinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Debt Refinance", "debtRefinanceAllowed"),
  bridgeToggle("Multifamily – 5+ Units", "multifamily5PlusAllowed"),
  bridgeToggle("Apartment", "apartmentAllowed"),
  bridgeToggle("Office", "officeAllowed"),
  bridgeToggle("Retail", "retailAllowed"),
  bridgeToggle("Industrial", "industrialAllowed"),
  bridgeToggle("Mixed-Use", "mixedUseAllowed"),
  bridgeToggle("Self-Storage", "selfStorageAllowed"),
  bridgeToggle("Hotel / Hospitality", "hotelHospitalityAllowed"),
  bridgeToggle("Healthcare / Medical", "medicalHealthcareAllowed"),
  bridgeToggle("Student Housing", "studentHousingAllowed"),
  bridgeToggle("Senior Housing", "seniorHousingAllowed"),
  bridgeToggle("Mobile Home Park", "mobileHomeParkAllowed"),
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Property Value ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Maximum Property Value ($)",
    key: "maxPropertyValue",
    required: true,
  },
  { label: "Minimum Annual NOI ($)", key: "minAnnualNoi", required: true },
  {
    label: "Minimum Loan Size for Property Type ($)",
    key: "minLoanSizeForPropertyType",
    required: true,
  },
  bridgeToggle("Stabilized Property Required", "stabilizedPropertyRequired"),
  bridgeToggle("Lease-Up Properties Accepted", "leaseUpPropertiesAccepted"),
  bridgeToggle("Value-Add Properties Accepted", "valueAddPropertiesAccepted"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Bad-Boy Guarantee Required", "badBoyGuaranteeRequired"),
  bridgeToggle("Springing Recourse", "springingRecourseAllowed"),
  bridgeToggle("Defeasance Allowed", "defeasanceAllowed"),
  bridgeToggle("Yield Maintenance", "yieldMaintenanceAllowed"),
  {
    label: "Interest-Only Period (Months)",
    key: "interestOnlyPeriodMonths",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle(
    "Property Condition Assessment Required",
    "propertyConditionAssessmentRequired",
  ),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const AGENCY_MULTIFAMILY_CRITERIA_FIELDS: CriteriaField[] = [
  {
    label: "Agency",
    key: "agencyProgram",
    type: "choice",
    required: true,
    options: [
      { label: "Fannie Mae", value: "FANNIE_MAE" },
      { label: "Freddie Mac", value: "FREDDIE_MAC" },
      { label: "Both", value: "BOTH" },
    ],
  },
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Property Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Ownership Experience (Years)",
    key: "minOwnershipExperienceYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Amortization (Months)",
    key: "amortizationMonths",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Rate & Term Refinance", "rateTermRefinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Supplemental Financing", "supplementalFinancingAllowed"),
  bridgeToggle("Multifamily – 5+ Units", "multifamily5PlusAllowed"),
  { label: "Minimum Units", key: "minUnits", required: true },
  { label: "Maximum Units", key: "maxUnits", required: true },
  bridgeToggle("Market-Rate Multifamily", "marketRateMultifamilyAllowed"),
  bridgeToggle("Affordable Housing", "affordableHousingAllowed"),
  bridgeToggle("Student Housing", "studentHousingAllowed"),
  bridgeToggle("Senior Housing", "seniorHousingAllowed"),
  bridgeToggle("Cooperative Housing", "cooperativeHousingAllowed"),
  bridgeToggle(
    "Manufactured Housing Community",
    "manufacturedHousingCommunityAllowed",
  ),
  bridgeToggle("Small Balance Multifamily", "smallBalanceMultifamilyAllowed"),
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Property Value ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Maximum Property Value ($)",
    key: "maxPropertyValue",
    required: true,
  },
  { label: "Minimum Annual NOI ($)", key: "minAnnualNoi", required: true },
  {
    label: "Minimum DSCR – Fixed Rate",
    key: "minDscrFixedRate",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Minimum DSCR – ARM",
    key: "minDscrArm",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  bridgeToggle("Stabilized Property Required", "stabilizedPropertyRequired"),
  bridgeToggle("Lease-Up Properties Accepted", "leaseUpPropertiesAccepted"),
  bridgeToggle("Value-Add Properties Accepted", "valueAddPropertiesAccepted"),
  bridgeToggle("New Construction", "newConstructionAllowed"),
  bridgeToggle("Renovation / Moderate Rehab", "renovationModerateRehabAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle(
    "Property Condition Assessment Required",
    "propertyConditionAssessmentRequired",
  ),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const MEZZ_PREFERRED_EQUITY_CRITERIA_FIELDS: CriteriaField[] = [
  {
    label: "Financing Type",
    key: "mezzPreferredFinancingType",
    type: "choice",
    required: true,
    options: [
      { label: "Mezzanine Debt", value: "MEZZANINE_DEBT" },
      { label: "Preferred Equity", value: "PREFERRED_EQUITY" },
      { label: "Both", value: "BOTH" },
    ],
  },
  {
    label: "Min Investment / Loan Amount ($)",
    key: "minLoan",
    required: true,
  },
  {
    label: "Max Investment / Loan Amount ($)",
    key: "maxLoan",
    required: true,
  },
  {
    label: "Min Interest Rate / Preferred Return (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate / Preferred Return (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Combined LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Combined LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV – Mezzanine (%)",
    key: "mezzLtvMax",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination / Placement Fee (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Sponsor Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Property Experience (Years)",
    key: "minOwnershipExperienceYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Refinance", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Acquisition Financing", "acquisitionFinancingAllowed"),
  bridgeToggle("Construction Financing", "constructionFinancingAllowed"),
  bridgeToggle("Bridge Financing", "bridgeFinancingAllowed"),
  bridgeToggle("Value-Add Financing", "valueAddFinancingAllowed"),
  bridgeToggle("Recapitalization", "recapitalizationAllowed"),
  bridgeToggle("Equity Gap Financing", "equityGapFinancingAllowed"),
  bridgeToggle("Multifamily", "multifamily5PlusAllowed"),
  bridgeToggle("Office", "officeAllowed"),
  bridgeToggle("Retail", "retailAllowed"),
  bridgeToggle("Industrial", "industrialAllowed"),
  bridgeToggle("Mixed-Use", "mixedUseAllowed"),
  bridgeToggle("Self-Storage", "selfStorageAllowed"),
  bridgeToggle("Hotel / Hospitality", "hotelHospitalityAllowed"),
  bridgeToggle("Senior Housing", "seniorHousingAllowed"),
  bridgeToggle("Student Housing", "studentHousingAllowed"),
  {
    label: "Minimum Property Value ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Maximum Property Value ($)",
    key: "maxPropertyValue",
    required: true,
  },
  {
    label: "Minimum Loan-to-Value (%)",
    key: "mezzLtvMin",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Maximum Stabilized LTV (%)",
    key: "maxStabilizedLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Minimum Annual NOI ($)", key: "minAnnualNoi", required: true },
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  bridgeToggle("Stabilized Properties", "stabilizedPropertyRequired"),
  bridgeToggle("Value-Add Properties", "valueAddPropertiesAccepted"),
  bridgeToggle("Lease-Up Properties", "leaseUpPropertiesAccepted"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Corporate / Completion Guarantee", "completionGuaranteeRequired"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Foreign National Sponsor", "foreignNationalsAllowed"),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle(
    "Property Condition Assessment",
    "propertyConditionAssessmentRequired",
  ),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const MEZZANINE_CRITERIA_FIELDS = MEZZ_PREFERRED_EQUITY_CRITERIA_FIELDS;
const PREFERRED_EQUITY_CRITERIA_FIELDS = MEZZ_PREFERRED_EQUITY_CRITERIA_FIELDS;

const SBA_TERM_FIELDS: CriteriaField[] = [
  {
    label: "Min Term (years)",
    key: "minTerm",
    required: true,
    termUnit: "years",
  },
  {
    label: "Max Term (years)",
    key: "maxTerm",
    required: true,
    termUnit: "years",
  },
];

const SBA_7A_COMMON_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "SBA Guarantee (%)", key: "sbaGuaranteePercent", required: true },
  { label: "Min DSCR", key: "minDscr", required: false, decimal: true },
  {
    label: "Personal Guarantee Required",
    key: "personalGuaranteeRequired",
    type: "toggle",
    required: false,
  },
  ...SBA_TERM_FIELDS,
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_GENERAL_CRITERIA_FIELDS: CriteriaField[] = [
  ...SBA_7A_COMMON_FIELDS.slice(0, 2),
  ...SBA_7A_COMMON_FIELDS.slice(2, 8),
  { label: "Avg Turnaround (days)", key: "avgTurnaroundDays", required: true },
  {
    label: "Preferred Lender (PLP)",
    key: "preferredLenderPlp",
    type: "toggle",
    required: false,
  },
  ...SBA_7A_COMMON_FIELDS.slice(8),
];

const SBA_7A_BUSINESS_ACQUISITION_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "mo",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Business Acquisition (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Real Estate Included (Months)",
    key: "maxTermRealEstate",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Preferred DSCR",
    key: "preferredDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  bridgeToggle("Seller Financing Allowed", "sellerFinancingAllowed"),
  bridgeToggle("Goodwill Financing", "goodwillFinancingAllowed"),
  bridgeToggle("Intangible Assets", "intangibleAssetsAllowed"),
  bridgeToggle("Equipment Included", "equipmentIncluded"),
  bridgeToggle("Real Estate Included", "realEstateIncluded"),
  bridgeToggle("Working Capital Included", "workingCapitalEligible"),
  bridgeToggle("Franchise Acquisition", "franchiseAcquisitionAllowed"),
  bridgeToggle("Startup/Existing Business Acquisition", "startupAllowed"),
  bridgeToggle("Personal Guarantee", "personalGuaranteeRequired"),
  bridgeToggle("Collateral", "collateralRequired"),
  bridgeToggle(
    "Collateral may be used as Down payment",
    "collateralAsDownPaymentAllowed",
  ),
  {
    label: "Lender/SBA requirements apply",
    key: "criteriaNotes",
    type: "textarea",
    required: true,
  },
  {
    label: "Minimum Buyer Equity Injection (%)",
    key: "requiredInjection",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
];

const SBA_EXPRESS_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "mo",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Business Acquisition (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Real Estate Included (Months)",
    key: "maxTermRealEstate",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Equipment (Months)",
    key: "maxTermEquipment",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Amortization",
    key: "amortizationYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Preferred DSCR",
    key: "preferredDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Maximum Debt Service",
    key: "maximumDebtService",
    required: true,
  },
  bridgeToggle("Seller Financing Allowed", "sellerFinancingAllowed"),
  bridgeToggle("Goodwill Financing", "goodwillFinancingAllowed"),
  bridgeToggle("Intangible Assets", "intangibleAssetsAllowed"),
  bridgeToggle("Equipment Included", "equipmentIncluded"),
  bridgeToggle("Real Estate Included", "realEstateIncluded"),
  bridgeToggle("Sale-Leaseback Available", "saleLeasebackAvailable"),
  bridgeToggle("Owner Occupied Real Estate", "ownerOccupiedRequired"),
  bridgeToggle("Business Acquisition", "businessAcquisitionAllowed"),
  bridgeToggle("Equipment Purchase", "equipmentPurchaseAllowed"),
  bridgeToggle("Debt Refinance", "refinanceAllowed"),
  {
    label: "Collateral Required",
    key: "collateralRequired",
    type: "toggle",
    helperText:
      "SBA generally does not require collateral for SBA Express loans ≤ $50,000",
  },
  bridgeToggle(
    "Collateral may be used as Down payment",
    "collateralAsDownPaymentAllowed",
  ),
  bridgeToggle("Personal Guarantee", "personalGuaranteeRequired"),
  bridgeToggle("Business Credit", "businessCreditRequired"),
  bridgeToggle("U.S. Operating Business Required", "usOperatingBusinessRequired"),
  bridgeToggle("Startup Eligible", "startupEligible"),
  bridgeToggle("Franchise Eligible", "franchiseEligible"),
  bridgeToggle("Foreign Ownership", "foreignOwnershipAllowed"),
  bridgeToggle("Bankruptcy Allowed", "bankruptcyAllowed"),
  bridgeToggle("Prepayment Penalty", "prepaymentPenalty"),
  bridgeToggle("Working Capital Included", "workingCapitalEligible"),
  bridgeToggle("Franchise Acquisition", "franchiseAcquisitionAllowed"),
  bridgeToggle("Startup/Existing Business Acquisition", "startupAllowed"),
  {
    label: "Minimum Buyer Equity Injection (%)",
    key: "requiredInjection",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
];

const SBA_7A_WORKING_CAPITAL_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("Working Capital Allowed", "workingCapitalEligible"),
  bridgeToggle("Revolving Line Available", "lineOfCreditAvailable"),
  bridgeToggle("Seasonal Working Capital", "seasonalWorkingCapitalAllowed"),
  bridgeToggle("Inventory Financing", "inventoryFinancingAllowed"),
  bridgeToggle(
    "Accounts Receivable Financing",
    "accountsReceivableFinancingAllowed",
  ),
  bridgeToggle("Debt Refinance Allowed", "refinanceAllowed"),
  bridgeToggle("Equipment Purchase Allowed", "equipmentPurchaseAllowed"),
  bridgeToggle("Real Estate Component Allowed", "realEstateIncluded"),
  bridgeToggle("Startup Businesses Allowed", "startupAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const SBA_7A_EQUIPMENT_PURCHASE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("New Equipment", "newEquipmentAllowed"),
  bridgeToggle("Used Equipment", "usedEquipmentAllowed"),
  bridgeToggle("Equipment Refinance", "equipmentRefinanceAllowed"),
  bridgeToggle("Equipment Purchase", "equipmentPurchaseAllowed"),
  bridgeToggle("Equipment + Working Capital", "workingCapitalEligible"),
  bridgeToggle("Installation Costs", "installationCostsFinanced"),
  bridgeToggle("Soft Costs Financed", "softCostsFinanced"),
  bridgeToggle("Leasehold Improvements", "leaseholdImprovementsAllowed"),
  bridgeToggle("Startup Businesses", "startupAllowed"),
  bridgeToggle("Existing Business", "existingBusinessAllowed"),
  bridgeToggle(
    "Business Acquisition + Equipment",
    "businessAcquisitionAllowed",
  ),
  bridgeToggle("Owner-Occupied Business", "ownerOccupiedAllowed"),
  bridgeToggle("Franchise Businesses", "franchiseEligible"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  {
    label: "Minimum Equipment Value ($)",
    key: "minEquipmentValue",
    required: true,
  },
  {
    label: "Maximum Equipment Value ($)",
    key: "maxEquipmentValue",
    required: true,
  },
  {
    label: "Maximum Equipment Age (Years)",
    key: "maxEquipmentAgeYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Minimum Useful Life Remaining (Years)",
    key: "minUsefulLifeRemainingYears",
    required: true,
    inputSuffix: "yr",
  },
  bridgeToggle("Equipment Appraisal Required", "equipmentAppraisalRequired"),
  bridgeToggle("Vendor Invoice Required", "vendorInvoiceRequired"),
  {
    label: "Equipment Types Excluded",
    key: "equipmentTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const SBA_7A_REAL_ESTATE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "300 months / 25 years",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("Owner-Occupied Real Estate", "ownerOccupiedAllowed"),
  bridgeToggle("Investment Property", "investmentPropertyAllowed"),
  bridgeToggle("Commercial Real Estate", "commercialRealEstateAllowed"),
  bridgeToggle("Multifamily (5+ Units)", "multifamily5PlusAllowed"),
  bridgeToggle("Construction / Ground-Up", "groundUpConstructionAllowed"),
  bridgeToggle("Refinance Allowed", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Purchase Allowed", "purchaseAllowed"),
  bridgeToggle("Renovation / Improvements", "renovationAllowed"),
  bridgeToggle("Equipment Included", "equipmentIncluded"),
  bridgeToggle("Working Capital Included", "workingCapitalEligible"),
  bridgeToggle("Startup Businesses Allowed", "startupAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  bridgeToggle("Environmental Report Required", "environmentalReportRequired"),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const SBA_504_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Real Estate (Months)",
    key: "maxTermRealEstate",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "300 months / 25 years",
  },
  {
    label: "Max Term – Equipment (Months)",
    key: "maxTermEquipment",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "120 months / 10 years",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("Owner-Occupied Real Estate", "ownerOccupiedAllowed"),
  bridgeToggle("Commercial Real Estate Purchase", "commercialRealEstateAllowed"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Renovation / Improvements", "renovationAllowed"),
  bridgeToggle("Equipment Purchase", "equipmentPurchaseAllowed"),
  bridgeToggle("New Equipment", "newEquipmentAllowed"),
  bridgeToggle("Used Equipment", "usedEquipmentAllowed"),
  bridgeToggle("Refinance Existing Debt", "refinanceAllowed"),
  bridgeToggle(
    "Eligible Debt Refinance – Cash Out",
    "cashOutRefinanceAllowed",
  ),
  bridgeToggle("Working Capital", "workingCapitalEligible"),
  bridgeToggle("Startup Businesses", "startupAllowed"),
  bridgeToggle("Business Acquisition", "businessAcquisitionAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  bridgeToggle("Environmental Report Required", "environmentalReportRequired"),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const USDA_BI_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term – Real Estate (Months)",
    key: "maxTermRealEstate",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "360 months / 30 years",
  },
  {
    label: "Max Term – Equipment (Months)",
    key: "maxTermEquipment",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "180 months / 15 years",
  },
  {
    label: "Max Term – Working Capital (Months)",
    key: "maxTermWorkingCapital",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
    helperText: "84 months / 7 years",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("Owner-Occupied Real Estate", "ownerOccupiedAllowed"),
  bridgeToggle("Commercial Real Estate", "commercialRealEstateAllowed"),
  bridgeToggle("Multifamily", "multifamily5PlusAllowed"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Renovation / Improvements", "renovationAllowed"),
  bridgeToggle("Equipment Purchase", "equipmentPurchaseAllowed"),
  bridgeToggle("New Equipment", "newEquipmentAllowed"),
  bridgeToggle("Used Equipment", "usedEquipmentAllowed"),
  bridgeToggle("Working Capital", "workingCapitalEligible"),
  bridgeToggle("Inventory", "inventoryFinancingAllowed"),
  bridgeToggle("Business Acquisition", "businessAcquisitionAllowed"),
  bridgeToggle("Debt Refinance", "refinanceAllowed"),
  bridgeToggle("Debt Refinance with Cash-Out", "cashOutRefinanceAllowed"),
  bridgeToggle("Leasehold Improvements", "leaseholdImprovementsAllowed"),
  bridgeToggle("Startup Businesses", "startupAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  bridgeToggle("Environmental Report Required", "environmentalReportRequired"),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  bridgeToggle("Eligible Rural Areas Only", "ruralAreaRequired"),
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const C_PACE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  {
    label: "Min Debt Yield (%)",
    key: "minDebtYield",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Property Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Ownership Experience (Years)",
    key: "minOwnershipExperienceYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  {
    label: "Amortization (Months)",
    key: "amortizationMonths",
    required: true,
    termUnit: "months",
    inputSuffix: "mo",
  },
  bridgeToggle("Interest-Only Available", "interestOnlyAvailable"),
  bridgeToggle("Purchase", "purchaseAllowed"),
  bridgeToggle("Refinance", "refinanceAllowed"),
  bridgeToggle("Cash-Out Refinance", "cashOutRefinanceAllowed"),
  bridgeToggle("Construction", "constructionAllowed"),
  bridgeToggle("New Construction", "newConstructionAllowed"),
  bridgeToggle("Renovation / Retrofit", "renovationAllowed"),
  bridgeToggle(
    "Energy Efficiency Improvements",
    "energyEfficiencyImprovementsAllowed",
  ),
  bridgeToggle(
    "Renewable Energy Improvements",
    "renewableEnergyImprovementsAllowed",
  ),
  bridgeToggle(
    "Water Efficiency Improvements",
    "waterEfficiencyImprovementsAllowed",
  ),
  bridgeToggle("Resiliency Improvements", "resiliencyImprovementsAllowed"),
  bridgeToggle("Seismic Improvements", "seismicImprovementsAllowed"),
  bridgeToggle("HVAC / Building Systems", "hvacBuildingSystemsAllowed"),
  bridgeToggle("Solar / Renewable Energy", "solarRenewableEnergyAllowed"),
  bridgeToggle("Roof Improvements", "roofImprovementsAllowed"),
  bridgeToggle("Lighting Improvements", "lightingImprovementsAllowed"),
  bridgeToggle("Building Envelope", "buildingEnvelopeAllowed"),
  bridgeToggle("Multifamily", "multifamily5PlusAllowed"),
  bridgeToggle("Office", "officeAllowed"),
  bridgeToggle("Retail", "retailAllowed"),
  bridgeToggle("Industrial", "industrialAllowed"),
  bridgeToggle("Hospitality / Hotel", "hotelHospitalityAllowed"),
  bridgeToggle("Self-Storage", "selfStorageAllowed"),
  bridgeToggle("Mixed-Use", "mixedUseAllowed"),
  bridgeToggle("Healthcare / Medical", "medicalHealthcareAllowed"),
  {
    label: "Minimum Property Value ($)",
    key: "minPropertyValue",
    required: true,
  },
  {
    label: "Maximum Property Value ($)",
    key: "maxPropertyValue",
    required: true,
  },
  { label: "Minimum Annual NOI ($)", key: "minAnnualNoi", required: true },
  {
    label: "Minimum Occupancy (%)",
    key: "minOccupancy",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  bridgeToggle("Stabilized Property Required", "stabilizedPropertyRequired"),
  bridgeToggle("Value-Add Properties Accepted", "valueAddPropertiesAccepted"),
  bridgeToggle("Ground-Up Construction", "groundUpConstructionAllowed"),
  bridgeToggle("Non-Recourse Available", "nonRecourseAvailable"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Property Owner Consent Required", "propertyOwnerConsentRequired"),
  bridgeToggle("Senior Lender Consent Required", "seniorLenderConsentRequired"),
  bridgeToggle(
    "Mortgage Lender Consent Required",
    "mortgageLenderConsentRequired",
  ),
  bridgeToggle("Environmental Required", "environmentalReportRequired"),
  bridgeToggle("Energy Audit Required", "energyAuditRequired"),
  bridgeToggle(
    "Property Assessment Required",
    "propertyConditionAssessmentRequired",
  ),
  bridgeToggle("Appraisal Required", "appraisalRequired"),
  {
    label: "Property Types Excluded",
    key: "propertyTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const PURCHASE_ORDER_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Facility Amount ($)", key: "minFacilitySize", required: true },
  { label: "Max Facility Amount ($)", key: "maxFacilitySize", required: true },
  {
    label: "Min Advance Rate (%)",
    key: "minAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Advance Rate (%)",
    key: "maxAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Interest / Discount Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest / Discount Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination / Facility Fee (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  {
    label: "Min Gross Margin (%)",
    key: "minGrossMargin",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  bridgeToggle("Domestic Purchase Orders", "domesticPosAllowed"),
  bridgeToggle("International Purchase Orders", "internationalPosAllowed"),
  bridgeToggle("Government Purchase Orders", "governmentPosAllowed"),
  bridgeToggle("B2B Purchase Orders", "b2bReceivablesAllowed"),
  bridgeToggle("B2C Purchase Orders", "b2cReceivablesAllowed"),
  bridgeToggle("Recurring Purchase Orders", "recurringPosAllowed"),
  bridgeToggle("One-Time Purchase Orders", "oneTimePosAllowed"),
  bridgeToggle("Manufacturing Required", "manufacturingRequired"),
  bridgeToggle("Finished Goods", "finishedGoodsAllowed"),
  bridgeToggle("Raw Materials", "rawMaterialsAllowed"),
  bridgeToggle("Supplier / Vendor Payment", "supplierVendorPaymentAllowed"),
  bridgeToggle("Purchase Order Assignment", "purchaseOrderAssignmentAllowed"),
  { label: "Minimum PO Amount ($)", key: "minPoAmount", required: true },
  { label: "Maximum PO Amount ($)", key: "maxPoAmount", required: true },
  {
    label: "Minimum Customer Credit Score",
    key: "minCustomerCreditScore",
    required: true,
  },
  {
    label: "Minimum Customer Credit Rating",
    key: "minCustomerCreditRating",
    type: "text",
    required: true,
  },
  {
    label: "Maximum Customer Concentration (%)",
    key: "maxCustomerConcentration",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Gross Profit Margin (%)",
    key: "minGrossProfitMargin",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Customer Deposit (%)",
    key: "minCustomerDeposit",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  bridgeToggle("Customer Verification Required", "customerVerificationRequired"),
  bridgeToggle("Supplier Verification Required", "vendorVerificationRequired"),
  bridgeToggle("Existing Liens Accepted", "existingLiensAccepted"),
  bridgeToggle("Tax Liens Accepted", "taxLiensAccepted"),
  bridgeToggle("Startups Accepted", "startupAllowed"),
  bridgeToggle("Foreign-Owned Businesses", "foreignOwnershipAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("UCC Filing Required", "uccFilingRequired"),
  {
    label: "Minimum Eligible PO Value ($)",
    key: "minEligiblePoValue",
    required: true,
  },
  {
    label: "Maximum PO Concentration (%)",
    key: "maxPoConcentration",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const INVOICE_FACTORING_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Facility Amount ($)", key: "minFacilitySize", required: true },
  { label: "Max Facility Amount ($)", key: "maxFacilitySize", required: true },
  {
    label: "Min Advance Rate (%)",
    key: "minAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Advance Rate (%)",
    key: "maxAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Discount / Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Discount / Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination / Facility Fee (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Min Monthly A/R ($)", key: "minMonthlyAr", required: true },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  bridgeToggle("Recourse Factoring", "recourseFactoringAllowed"),
  bridgeToggle("Non-Recourse Factoring", "nonRecourseAvailable"),
  bridgeToggle("Invoice Factoring", "invoiceFactoringAllowed"),
  bridgeToggle("A/R Line of Credit", "arLineOfCreditAllowed"),
  bridgeToggle("Asset-Based Lending (ABL)", "assetBasedLendingAllowed"),
  bridgeToggle("Purchase Order Financing", "purchaseOrderFinancingAllowed"),
  bridgeToggle("Domestic A/R", "domesticArAllowed"),
  bridgeToggle("International A/R", "internationalArAllowed"),
  bridgeToggle("Government A/R", "governmentInvoicesOk"),
  bridgeToggle("B2B Receivables", "b2bReceivablesAllowed"),
  bridgeToggle("B2C Receivables", "b2cReceivablesAllowed"),
  {
    label: "Concentration Limit (%)",
    key: "concentrationLimit",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Minimum Invoice Size ($)", key: "minInvoiceSize", required: true },
  { label: "Maximum Invoice Size ($)", key: "maxInvoiceSize", required: true },
  {
    label: "Minimum Invoice Age (Days)",
    key: "minInvoiceAgeDays",
    required: true,
  },
  {
    label: "Maximum Invoice Age (Days)",
    key: "maxInvoiceAgeDays",
    required: true,
  },
  {
    label: "Maximum Invoice Dilution (%)",
    key: "maxInvoiceDilution",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Debtor Credit Score",
    key: "minDebtorCreditScore",
    required: true,
  },
  bridgeToggle(
    "Customer Credit Insurance Required",
    "customerCreditInsuranceRequired",
  ),
  bridgeToggle("Existing Liens Accepted", "existingLiensAccepted"),
  bridgeToggle("Tax Liens Accepted", "taxLiensAccepted"),
  bridgeToggle("Startups Accepted", "startupAllowed"),
  bridgeToggle("Foreign-Owned Businesses", "foreignOwnershipAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("UCC Filing Required", "uccFilingRequired"),
  {
    label: "Minimum Eligible A/R ($)",
    key: "minEligibleAr",
    required: true,
  },
  {
    label: "Maximum A/R Concentration (%)",
    key: "maxArConcentration",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const ACCOUNTS_PAYABLE_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Facility Amount ($)", key: "minFacilitySize", required: true },
  { label: "Max Facility Amount ($)", key: "maxFacilitySize", required: true },
  {
    label: "Min Advance Rate (%)",
    key: "minAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Advance Rate (%)",
    key: "maxAdvanceRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Interest / Discount Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest / Discount Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination / Facility Fee (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  {
    label: "Min Monthly Payables ($)",
    key: "minMonthlyPayables",
    required: true,
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  bridgeToggle("Vendor / Supplier Financing", "vendorSupplierFinancingAllowed"),
  bridgeToggle("Trade Payables Financing", "tradePayablesFinancingAllowed"),
  bridgeToggle(
    "Purchase Order Related Financing",
    "purchaseOrderFinancingAllowed",
  ),
  bridgeToggle("Inventory Financing", "inventoryFinancingAllowed"),
  bridgeToggle("Supply Chain Finance", "supplyChainFinanceAllowed"),
  bridgeToggle("Domestic Vendors", "domesticVendorsAllowed"),
  bridgeToggle("International Vendors", "internationalVendorsAllowed"),
  bridgeToggle("B2B Businesses", "b2bReceivablesAllowed"),
  bridgeToggle("B2C Businesses", "b2cReceivablesAllowed"),
  bridgeToggle("Government Contractors", "governmentContractorsAllowed"),
  {
    label: "Minimum Invoice Amount ($)",
    key: "minInvoiceSize",
    required: true,
  },
  {
    label: "Maximum Invoice Amount ($)",
    key: "maxInvoiceSize",
    required: true,
  },
  {
    label: "Minimum Invoice Age (Days)",
    key: "minInvoiceAgeDays",
    required: true,
  },
  {
    label: "Maximum Invoice Age (Days)",
    key: "maxInvoiceAgeDays",
    required: true,
  },
  {
    label: "Maximum Vendor Concentration (%)",
    key: "maxVendorConcentration",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Minimum Vendor Credit Quality",
    key: "minVendorCreditQuality",
    required: true,
  },
  bridgeToggle("Vendor Verification Required", "vendorVerificationRequired"),
  bridgeToggle("Purchase Order Required", "purchaseOrderRequired"),
  bridgeToggle("Existing Liens Accepted", "existingLiensAccepted"),
  bridgeToggle("Tax Liens Accepted", "taxLiensAccepted"),
  bridgeToggle("Startups Accepted", "startupAllowed"),
  bridgeToggle("Foreign-Owned Businesses", "foreignOwnershipAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("UCC Filing Required", "uccFilingRequired"),
  {
    label: "Minimum Eligible Payables ($)",
    key: "minEligiblePayables",
    required: true,
  },
  {
    label: "Maximum Payables Concentration (%)",
    key: "maxPayablesConcentration",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

const EQUIPMENT_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Min Interest Rate (%)",
    key: "minRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max Interest Rate (%)",
    key: "maxRate",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTV (%)",
    key: "maxLtv",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Max LTC (%)",
    key: "maxLtc",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Min Industry Experience (Years)",
    key: "experience",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Time in Business (Years)",
    key: "minTimeInBusiness",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Min Term (Months)",
    key: "minTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Max Term (Months)",
    key: "maxTerm",
    required: true,
    termUnit: "months",
  },
  {
    label: "Min DSCR",
    key: "minDscr",
    required: true,
    decimal: true,
    inputSuffix: "x",
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  { label: "Minimum EBITDA ($)", key: "minEbitda", required: true },
  bridgeToggle("New Equipment", "newEquipmentAllowed"),
  bridgeToggle("Used Equipment", "usedEquipmentAllowed"),
  bridgeToggle("Equipment Refinance", "equipmentRefinanceAllowed"),
  bridgeToggle("Equipment Purchase", "equipmentPurchaseAllowed"),
  bridgeToggle("Equipment Lease", "equipmentLeaseAllowed"),
  bridgeToggle("Lease-to-Own", "leaseToOwnAllowed"),
  bridgeToggle("Sale-Leaseback", "saleLeasebackAvailable"),
  bridgeToggle("Soft Costs Financed", "softCostsFinanced"),
  bridgeToggle("Installation Costs", "installationCostsFinanced"),
  bridgeToggle(
    "Transportation / Freight Costs",
    "transportationFreightCostsFinanced",
  ),
  bridgeToggle("Working Capital Included", "workingCapitalEligible"),
  bridgeToggle("Startups Accepted", "startupAllowed"),
  bridgeToggle("First-Time Business Owners", "firstTimeBusinessOwnersAllowed"),
  bridgeToggle("Foreign National Borrowers", "foreignNationalsAllowed"),
  bridgeToggle("LLC / Entity Borrower", "llcEntityBorrowerAllowed"),
  bridgeToggle("Bankruptcy", "bankruptcyAllowed"),
  bridgeToggle("Personal Guarantee Required", "personalGuaranteeRequired"),
  bridgeToggle("Collateral Required", "collateralRequired"),
  {
    label: "Minimum Equipment Value ($)",
    key: "minEquipmentValue",
    required: true,
  },
  {
    label: "Maximum Equipment Value ($)",
    key: "maxEquipmentValue",
    required: true,
  },
  {
    label: "Maximum Equipment Age (Years)",
    key: "maxEquipmentAgeYears",
    required: true,
    inputSuffix: "yr",
  },
  {
    label: "Minimum Useful Life Remaining (Years)",
    key: "minUsefulLifeRemainingYears",
    required: true,
    inputSuffix: "yr",
  },
  bridgeToggle("Equipment Appraisal Required", "equipmentAppraisalRequired"),
  bridgeToggle("Vendor Invoice Required", "vendorInvoiceRequired"),
  {
    label: "Equipment Types Excluded",
    key: "equipmentTypesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Industries Excluded",
    key: "industriesExcluded",
    type: "textarea",
    required: false,
  },
  {
    label: "Additional Guidelines",
    key: "criteriaNotes",
    type: "textarea",
    required: false,
  },
];

export const isBridgeLoanProduct = (productCode?: string | null) =>
  productCode ? BRIDGE_LOAN_CODES.has(productCode) : false;

export const isFixAndFlipProduct = (productCode?: string | null) =>
  productCode ? FIX_AND_FLIP_CODES.has(productCode) : false;

export const isDscrRentalProduct = (productCode?: string | null) =>
  productCode ? DSCR_RENTAL_CODES.has(productCode) : false;

export const isRentalPortfolioProduct = (productCode?: string | null) =>
  productCode ? RENTAL_PORTFOLIO_CODES.has(productCode) : false;

export const isConstructionLoanProduct = (productCode?: string | null) =>
  productCode ? CONSTRUCTION_LOAN_CODES.has(productCode) : false;

export const isCrePermanentProduct = (productCode?: string | null) =>
  productCode ? CRE_PERMANENT_LOAN_CODES.has(productCode) : false;

export const isCmbsProduct = (productCode?: string | null) =>
  productCode ? CMBS_LOAN_CODES.has(productCode) : false;

export const isAgencyMultifamilyProduct = (productCode?: string | null) =>
  productCode ? AGENCY_MULTIFAMILY_LOAN_CODES.has(productCode) : false;

export const isMezzanineProduct = (productCode?: string | null) =>
  productCode ? MEZZANINE_LOAN_CODES.has(productCode) : false;

export const isPreferredEquityProduct = (productCode?: string | null) =>
  productCode ? PREFERRED_EQUITY_LOAN_CODES.has(productCode) : false;

export const isMezzOrPreferredEquityProduct = (
  productCode?: string | null,
) => isMezzanineProduct(productCode) || isPreferredEquityProduct(productCode);

export const isSba7aGeneralProduct = (productCode?: string | null) =>
  productCode ? SBA_7A_GENERAL_LOAN_CODES.has(productCode) : false;

export const isSba7aBusinessAcquisitionProduct = (productCode?: string | null) =>
  productCode ? SBA_7A_BUSINESS_ACQUISITION_LOAN_CODES.has(productCode) : false;

export const isSba7aWorkingCapitalProduct = (productCode?: string | null) =>
  productCode ? SBA_7A_WORKING_CAPITAL_LOAN_CODES.has(productCode) : false;

export const isSba7aEquipmentPurchaseProduct = (productCode?: string | null) =>
  productCode ? SBA_7A_EQUIPMENT_PURCHASE_LOAN_CODES.has(productCode) : false;

export const isSba7aRealEstateProduct = (productCode?: string | null) =>
  productCode ? SBA_7A_REAL_ESTATE_LOAN_CODES.has(productCode) : false;

export const isSbaExpressProduct = (productCode?: string | null) =>
  productCode ? SBA_EXPRESS_LOAN_CODES.has(productCode) : false;

export const isSba504Product = (productCode?: string | null) =>
  productCode ? SBA_504_LOAN_CODES.has(productCode) : false;

export const isUsdaBiProduct = (productCode?: string | null) =>
  productCode ? USDA_BI_LOAN_CODES.has(productCode) : false;

export const isCPaceProduct = (productCode?: string | null) =>
  productCode ? C_PACE_LOAN_CODES.has(productCode) : false;

export const isPurchaseOrderFinanceProduct = (productCode?: string | null) =>
  productCode ? PURCHASE_ORDER_FINANCE_LOAN_CODES.has(productCode) : false;

export const isEquipmentFinanceProduct = (productCode?: string | null) =>
  productCode ? EQUIPMENT_FINANCE_LOAN_CODES.has(productCode) : false;

export const isArFactoringProduct = (productCode?: string | null) =>
  productCode ? INVOICE_FACTORING_LOAN_CODES.has(productCode) : false;

export const isApSupplyChainProduct = (productCode?: string | null) =>
  productCode ? ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES.has(productCode) : false;

export const isSba7aMaxLoanOnlyProduct = (productCode?: string | null) =>
  isSba7aGeneralProduct(productCode) ||
  isSba7aBusinessAcquisitionProduct(productCode) ||
  isSba7aWorkingCapitalProduct(productCode) ||
  isSba7aEquipmentPurchaseProduct(productCode) ||
  isSba7aRealEstateProduct(productCode) ||
  isSbaExpressProduct(productCode);

export const isAnySba7aProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode);

export const isAnySbaProduct = (productCode?: string | null) =>
  isAnySba7aProduct(productCode) ||
  isSba504Product(productCode) ||
  isSbaExpressProduct(productCode);

export const isNoMinLoanCriteriaProduct = (_productCode?: string | null) =>
  false;

export const isSba7aNoLtvProduct = (productCode?: string | null) =>
  isSba7aGeneralProduct(productCode);

export const supportsSbaLtcProduct = (productCode?: string | null) =>
  isSba7aBusinessAcquisitionProduct(productCode) ||
  isSba7aWorkingCapitalProduct(productCode) ||
  isSba7aEquipmentPurchaseProduct(productCode) ||
  isSbaExpressProduct(productCode) ||
  isSba504Product(productCode);

export const isNoLtvCriteriaProduct = (productCode?: string | null) =>
  isSba7aGeneralProduct(productCode);

export const isNoPropertyMetricsProduct = (productCode?: string | null) =>
  isSba7aGeneralProduct(productCode) ||
  isArFactoringProduct(productCode) ||
  isApSupplyChainProduct(productCode) ||
  isPurchaseOrderFinanceProduct(productCode);

export const isNoTermCriteriaProduct = (productCode?: string | null) =>
  isPurchaseOrderFinanceProduct(productCode) ||
  isArFactoringProduct(productCode) ||
  isApSupplyChainProduct(productCode);

export const isSba7aRateSpreadProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode);

const usesYearTerms = (_productCode: string) => false;

const toTermMonths = (value: unknown, productCode: string) => {
  if (value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return usesYearTerms(productCode)
    ? Math.round(numeric * 12)
    : Math.round(numeric);
};

const fromTermMonths = (value: unknown, productCode: string) => {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return usesYearTerms(productCode)
    ? String(numeric / 12)
    : String(numeric);
};

const getProductSpecificCriteriaFields = (
  productCode: string,
): CriteriaField[] => {
  if (isBridgeLoanProduct(productCode)) {
    return BRIDGE_CRITERIA_FIELDS;
  }

  if (isFixAndFlipProduct(productCode)) {
    return FIX_AND_FLIP_CRITERIA_FIELDS;
  }

  if (isDscrRentalProduct(productCode)) {
    return DSCR_RENTAL_CRITERIA_FIELDS;
  }

  if (isRentalPortfolioProduct(productCode)) {
    return RENTAL_PORTFOLIO_CRITERIA_FIELDS;
  }

  if (isConstructionLoanProduct(productCode)) {
    return CONSTRUCTION_CRITERIA_FIELDS;
  }

  if (isCrePermanentProduct(productCode)) {
    return CRE_PERMANENT_CRITERIA_FIELDS;
  }

  if (isCmbsProduct(productCode)) {
    return CMBS_CRITERIA_FIELDS;
  }

  if (isAgencyMultifamilyProduct(productCode)) {
    return AGENCY_MULTIFAMILY_CRITERIA_FIELDS;
  }

  if (isMezzanineProduct(productCode)) {
    return MEZZANINE_CRITERIA_FIELDS;
  }

  if (isPreferredEquityProduct(productCode)) {
    return PREFERRED_EQUITY_CRITERIA_FIELDS;
  }

  if (isSba7aGeneralProduct(productCode)) {
    return SBA_7A_GENERAL_CRITERIA_FIELDS;
  }

  if (isSba7aBusinessAcquisitionProduct(productCode)) {
    return SBA_7A_BUSINESS_ACQUISITION_CRITERIA_FIELDS;
  }

  if (isSbaExpressProduct(productCode)) {
    return SBA_EXPRESS_CRITERIA_FIELDS;
  }

  if (isSba7aWorkingCapitalProduct(productCode)) {
    return SBA_7A_WORKING_CAPITAL_CRITERIA_FIELDS;
  }

  if (isSba7aEquipmentPurchaseProduct(productCode)) {
    return SBA_7A_EQUIPMENT_PURCHASE_CRITERIA_FIELDS;
  }

  if (isSba7aRealEstateProduct(productCode)) {
    return SBA_7A_REAL_ESTATE_CRITERIA_FIELDS;
  }

  if (isSba504Product(productCode)) {
    return SBA_504_CRITERIA_FIELDS;
  }

  if (isUsdaBiProduct(productCode)) {
    return USDA_BI_CRITERIA_FIELDS;
  }

  if (isCPaceProduct(productCode)) {
    return C_PACE_CRITERIA_FIELDS;
  }

  if (isPurchaseOrderFinanceProduct(productCode)) {
    return PURCHASE_ORDER_FINANCE_CRITERIA_FIELDS;
  }

  if (isEquipmentFinanceProduct(productCode)) {
    return EQUIPMENT_FINANCE_CRITERIA_FIELDS;
  }

  if (isArFactoringProduct(productCode)) {
    return INVOICE_FACTORING_CRITERIA_FIELDS;
  }

  if (isApSupplyChainProduct(productCode)) {
    return ACCOUNTS_PAYABLE_FINANCE_CRITERIA_FIELDS;
  }

  return DEFAULT_CRITERIA_FIELDS.filter((field) => {
    if (field.excludeProducts?.includes(productCode)) return false;
    if (field.products && !field.products.includes(productCode)) return false;
    return true;
  });
};

export const getCriteriaFieldsForProduct = (
  productCode: string,
): CriteriaField[] => {
  if (isBridgeLoanProduct(productCode)) {
    return BRIDGE_CRITERIA_FIELDS;
  }

  if (isDscrRentalProduct(productCode)) {
    return DSCR_RENTAL_CRITERIA_FIELDS;
  }

  if (isFixAndFlipProduct(productCode)) {
    return FIX_AND_FLIP_CRITERIA_FIELDS;
  }

  if (isConstructionLoanProduct(productCode)) {
    return CONSTRUCTION_CRITERIA_FIELDS;
  }

  if (isCrePermanentProduct(productCode)) {
    return CRE_PERMANENT_CRITERIA_FIELDS;
  }

  if (isAgencyMultifamilyProduct(productCode)) {
    return AGENCY_MULTIFAMILY_CRITERIA_FIELDS;
  }

  if (isMezzOrPreferredEquityProduct(productCode)) {
    return MEZZ_PREFERRED_EQUITY_CRITERIA_FIELDS;
  }

  if (isCmbsProduct(productCode)) {
    return CMBS_CRITERIA_FIELDS;
  }

  if (isRentalPortfolioProduct(productCode)) {
    return RENTAL_PORTFOLIO_CRITERIA_FIELDS;
  }

  if (isSba7aBusinessAcquisitionProduct(productCode)) {
    return SBA_7A_BUSINESS_ACQUISITION_CRITERIA_FIELDS;
  }

  if (isSbaExpressProduct(productCode)) {
    return SBA_EXPRESS_CRITERIA_FIELDS;
  }

  if (isSba7aWorkingCapitalProduct(productCode)) {
    return SBA_7A_WORKING_CAPITAL_CRITERIA_FIELDS;
  }

  if (isSba7aRealEstateProduct(productCode)) {
    return SBA_7A_REAL_ESTATE_CRITERIA_FIELDS;
  }

  if (isSba7aEquipmentPurchaseProduct(productCode)) {
    return SBA_7A_EQUIPMENT_PURCHASE_CRITERIA_FIELDS;
  }

  if (isSba504Product(productCode)) {
    return SBA_504_CRITERIA_FIELDS;
  }

  if (isUsdaBiProduct(productCode)) {
    return USDA_BI_CRITERIA_FIELDS;
  }

  if (isCPaceProduct(productCode)) {
    return C_PACE_CRITERIA_FIELDS;
  }

  if (isEquipmentFinanceProduct(productCode)) {
    return EQUIPMENT_FINANCE_CRITERIA_FIELDS;
  }

  if (isArFactoringProduct(productCode)) {
    return INVOICE_FACTORING_CRITERIA_FIELDS;
  }

  if (isApSupplyChainProduct(productCode)) {
    return ACCOUNTS_PAYABLE_FINANCE_CRITERIA_FIELDS;
  }

  if (isPurchaseOrderFinanceProduct(productCode)) {
    return PURCHASE_ORDER_FINANCE_CRITERIA_FIELDS;
  }

  return mergeWithUniversalCriteriaFields(
    productCode,
    getProductSpecificCriteriaFields(productCode),
  );
};

export const getRequiredCriteriaKeysForProduct = (
  productCode: string,
): string[] =>
  getCriteriaFieldsForProduct(productCode)
    .filter((field) => field.required !== false && field.type !== "toggle")
    .map((field) => field.key);

export const getCriteriaFieldLabel = (
  productCode: string,
  fieldKey: string,
): string => {
  const field = getCriteriaFieldsForProduct(productCode).find(
    (entry) => entry.key === fieldKey,
  );

  if (!field?.label) {
    return fieldKey;
  }

  return field.label
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\*$/, "")
    .trim();
};

type LoanProductCriteriaValidationProduct = {
  id: string | number;
  name: string;
  code: string;
};

export const validateLoanProductCriteriaStep = (
  selectedProducts: LoanProductCriteriaValidationProduct[],
  loanCriteria: Record<string, any>,
): string | null => {
  for (const product of selectedProducts) {
    const data = loanCriteria?.[String(product.id)];

    if (!data) {
      return `Please fill details for ${product.name}`;
    }

    const requiredFields = getRequiredCriteriaKeysForProduct(product.code);

    for (const fieldKey of requiredFields) {
      if (!data[fieldKey] && data[fieldKey] !== 0) {
        const label = getCriteriaFieldLabel(product.code, fieldKey);
        return `${product.name}: ${label} is required`;
      }
    }

    if (!data.states || data.states.length === 0) {
      return `${product.name}: Select at least one state`;
    }

    if (isSba504Product(product.code)) {
      const total = Number(data.maxTotalProject);
      const debenture = Number(data.maxSba504Debenture);
      if (
        data.maxTotalProject &&
        data.maxSba504Debenture &&
        debenture > total
      ) {
        return `${product.name}: SBA 504 debenture cannot exceed total project amount`;
      }
    } else if (
      !isNoMinLoanCriteriaProduct(product.code) &&
      !isMezzanineProduct(product.code)
    ) {
      const minAmount = Number(
        data.minLoan ?? data.minFacilitySize ?? data.minProgramSize,
      );
      const maxAmount = Number(
        data.maxLoan ?? data.maxFacilitySize ?? data.maxProgramSize,
      );

      if (
        Number.isFinite(minAmount) &&
        Number.isFinite(maxAmount) &&
        minAmount > maxAmount
      ) {
        return `${product.name}: Minimum amount cannot exceed maximum amount`;
      }
    }

    if (isBridgeLoanProduct(product.code) || isCrePermanentProduct(product.code) || isAgencyMultifamilyProduct(product.code)) {
      const minPropertyValue = Number(data.minPropertyValue);
      const maxPropertyValue = Number(data.maxPropertyValue);

      if (
        Number.isFinite(minPropertyValue) &&
        Number.isFinite(maxPropertyValue) &&
        minPropertyValue > maxPropertyValue
      ) {
        return `${product.name}: Property value minimum cannot exceed maximum`;
      }
    }
  }

  return null;
};

export const getLoanCriteriaFooterMessage = (
  selectedProducts: LoanProductCriteriaValidationProduct[],
  loanCriteria: Record<string, any>,
  hasFieldErrors: boolean,
): string | null => {
  const stepError = validateLoanProductCriteriaStep(
    selectedProducts,
    loanCriteria,
  );

  if (stepError) {
    return stepError;
  }

  if (hasFieldErrors) {
    return "Please correct the highlighted errors in the loan criteria form.";
  }

  return null;
};

export const getDefaultCriteriaValuesForProduct = (
  _productCode: string,
): Record<string, any> => ({});

export const buildLenderProductCriteriaPayload = (
  criteria: Record<string, any>,
  productCode: string,
) => {
  const bridgeProduct = isBridgeLoanProduct(productCode);
  const fixAndFlipProduct = isFixAndFlipProduct(productCode);
  const dscrRentalProduct = isDscrRentalProduct(productCode);
  const constructionProduct = isConstructionLoanProduct(productCode);
  const crePermanentProduct = isCrePermanentProduct(productCode);
  const agencyMultifamilyProduct = isAgencyMultifamilyProduct(productCode);
  const residential1To4 =
    bridgeProduct ||
    dscrRentalProduct ||
    fixAndFlipProduct ||
    constructionProduct;
  const mezzanineProduct = isMezzanineProduct(productCode);
  const preferredEquityProduct = isPreferredEquityProduct(productCode);
  const mezzOrPrefProduct = mezzanineProduct || preferredEquityProduct;
  const rentalPortfolioProduct = isRentalPortfolioProduct(productCode);
  const cmbsProduct = isCmbsProduct(productCode);
  const occupancyBorrowerFlags =
    residential1To4 ||
    crePermanentProduct ||
    agencyMultifamilyProduct ||
    mezzOrPrefProduct ||
    cmbsProduct ||
    rentalPortfolioProduct;
  const creStylePropertyProduct =
    crePermanentProduct ||
    agencyMultifamilyProduct ||
    mezzOrPrefProduct ||
    cmbsProduct;
  const sba7aGeneralProduct = isSba7aGeneralProduct(productCode);
  const sba7aBusinessAcquisitionProduct =
    isSba7aBusinessAcquisitionProduct(productCode);
  const sbaExpressProduct = isSbaExpressProduct(productCode);
  const sbaAcquisitionStyleProduct =
    sba7aBusinessAcquisitionProduct || sbaExpressProduct;
  const sba7aWorkingCapitalProduct =
    isSba7aWorkingCapitalProduct(productCode);
  const sba7aEquipmentPurchaseProduct =
    isSba7aEquipmentPurchaseProduct(productCode);
  const sba7aRealEstateProduct = isSba7aRealEstateProduct(productCode);
  const sba504Product = isSba504Product(productCode);
  const usdaBiProduct = isUsdaBiProduct(productCode);
  const purchaseOrderProduct = isPurchaseOrderFinanceProduct(productCode);
  const equipmentFinanceProduct = isEquipmentFinanceProduct(productCode);
  const arFactoringProduct = isArFactoringProduct(productCode);
  const apSupplyChainProduct = isApSupplyChainProduct(productCode);
  const noMinLoanProduct = isNoMinLoanCriteriaProduct(productCode);
  const noPropertyMetricsProduct = isNoPropertyMetricsProduct(productCode);
  const noTermProduct = isNoTermCriteriaProduct(productCode);

  const payload = {
    minLoanAmount:
      !noMinLoanProduct &&
      criteria.minLoan !== undefined &&
      criteria.minLoan !== ""
        ? Number(criteria.minLoan)
        : (purchaseOrderProduct ||
              arFactoringProduct ||
              apSupplyChainProduct) &&
            criteria.minFacilitySize !== undefined &&
            criteria.minFacilitySize !== ""
          ? Number(criteria.minFacilitySize)
          : apSupplyChainProduct &&
              criteria.minProgramSize !== undefined &&
              criteria.minProgramSize !== ""
            ? Number(criteria.minProgramSize)
            : null,
    maxLoanAmount:
      criteria.maxLoan !== undefined && criteria.maxLoan !== ""
        ? Number(criteria.maxLoan)
        : (purchaseOrderProduct ||
              arFactoringProduct ||
              apSupplyChainProduct) &&
            criteria.maxFacilitySize !== undefined &&
            criteria.maxFacilitySize !== ""
          ? Number(criteria.maxFacilitySize)
          : apSupplyChainProduct &&
              criteria.maxProgramSize !== undefined &&
              criteria.maxProgramSize !== ""
            ? Number(criteria.maxProgramSize)
            : null,
    minTermMonths: noTermProduct
      ? null
      : toTermMonths(criteria.minTerm, productCode),
    maxTermMonths: noTermProduct
      ? null
      : toTermMonths(criteria.maxTerm, productCode),
    maxLtvPercent:
      !noPropertyMetricsProduct &&
      criteria.maxLtv !== undefined &&
      criteria.maxLtv !== ""
        ? Number(criteria.maxLtv)
        : null,
    minMezzLtvPercent:
      (mezzOrPrefProduct ||
        (criteria.minLtv !== undefined && criteria.minLtv !== "")) &&
      ((criteria.mezzLtvMin !== undefined && criteria.mezzLtvMin !== "") ||
        (criteria.minLtv !== undefined && criteria.minLtv !== ""))
        ? Number(
            criteria.mezzLtvMin !== undefined && criteria.mezzLtvMin !== ""
              ? criteria.mezzLtvMin
              : criteria.minLtv,
          )
        : null,
    maxMezzLtvPercent:
      mezzOrPrefProduct &&
      criteria.mezzLtvMax !== undefined &&
      criteria.mezzLtvMax !== ""
        ? Number(criteria.mezzLtvMax)
        : null,
    exitFeePercent:
      (mezzanineProduct || preferredEquityProduct) &&
      criteria.exitFee !== undefined &&
      criteria.exitFee !== ""
        ? Number(criteria.exitFee)
        : null,
    maxRateSpreadPercent: isSba7aRateSpreadProduct(productCode)
      ? criteria.maxRateSpread !== undefined && criteria.maxRateSpread !== ""
        ? Number(criteria.maxRateSpread)
        : criteria.maxRate !== undefined && criteria.maxRate !== ""
          ? Number(criteria.maxRate)
          : null
      : null,
    minRateSpreadPercent: isSba7aRateSpreadProduct(productCode)
      ? criteria.minRateSpread !== undefined && criteria.minRateSpread !== ""
        ? Number(criteria.minRateSpread)
        : criteria.minRate !== undefined && criteria.minRate !== ""
          ? Number(criteria.minRate)
          : null
      : null,
    sbaGuaranteePercent:
      isAnySba7aProduct(productCode) &&
      criteria.sbaGuaranteePercent !== undefined &&
      criteria.sbaGuaranteePercent !== ""
        ? Number(criteria.sbaGuaranteePercent)
        : null,
    avgTurnaroundDays:
      (sba7aGeneralProduct || sba504Product) &&
      criteria.avgTurnaroundDays !== undefined &&
      criteria.avgTurnaroundDays !== ""
        ? Number(criteria.avgTurnaroundDays)
        : null,
    preferredLenderPlp: sba7aGeneralProduct
      ? Boolean(criteria.preferredLenderPlp)
      : false,
    requiredInjectionPercent:
      (sbaAcquisitionStyleProduct || sba504Product) &&
      criteria.requiredInjection !== undefined &&
      criteria.requiredInjection !== ""
        ? Number(criteria.requiredInjection)
        : null,
    goodwillFinancingAllowed: sbaAcquisitionStyleProduct
      ? Boolean(criteria.goodwillFinancingAllowed)
      : false,
    sellerFinancingAllowed: sbaAcquisitionStyleProduct
      ? Boolean(criteria.sellerFinancingAllowed)
      : false,
    intangibleAssetsAllowed: sbaAcquisitionStyleProduct
      ? Boolean(criteria.intangibleAssetsAllowed)
      : false,
    equipmentIncluded:
      sbaAcquisitionStyleProduct || sba7aRealEstateProduct
        ? Boolean(criteria.equipmentIncluded)
        : false,
    realEstateIncluded:
      sbaAcquisitionStyleProduct || sba7aWorkingCapitalProduct
        ? Boolean(criteria.realEstateIncluded)
        : false,
    franchiseAcquisitionAllowed: sbaAcquisitionStyleProduct
      ? Boolean(criteria.franchiseAcquisitionAllowed)
      : false,
    collateralRequired:
      sbaAcquisitionStyleProduct ||
      equipmentFinanceProduct ||
      sba7aWorkingCapitalProduct ||
      sba7aRealEstateProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.collateralRequired)
        : false,
    collateralAsDownPaymentAllowed: sbaAcquisitionStyleProduct
      ? Boolean(criteria.collateralAsDownPaymentAllowed)
      : false,
    preferredDscr:
      sbaAcquisitionStyleProduct &&
      criteria.preferredDscr !== undefined &&
      criteria.preferredDscr !== ""
        ? Number(criteria.preferredDscr)
        : null,
    maxTermRealEstateMonths:
      (sbaAcquisitionStyleProduct || sba504Product || usdaBiProduct) &&
      criteria.maxTermRealEstate !== undefined &&
      criteria.maxTermRealEstate !== ""
        ? Number(criteria.maxTermRealEstate)
        : null,
    maxTermEquipmentMonths:
      (sbaExpressProduct || sba504Product || usdaBiProduct) &&
      criteria.maxTermEquipment !== undefined &&
      criteria.maxTermEquipment !== ""
        ? Number(criteria.maxTermEquipment)
        : null,
    maxTermWorkingCapitalMonths:
      usdaBiProduct &&
      criteria.maxTermWorkingCapital !== undefined &&
      criteria.maxTermWorkingCapital !== ""
        ? Number(criteria.maxTermWorkingCapital)
        : null,
    maximumDebtService:
      sbaExpressProduct &&
      criteria.maximumDebtService !== undefined &&
      criteria.maximumDebtService !== ""
        ? Number(criteria.maximumDebtService)
        : null,
    businessAcquisitionAllowed:
      sbaExpressProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.businessAcquisitionAllowed)
        : false,
    equipmentPurchaseAllowed:
      sbaExpressProduct ||
      equipmentFinanceProduct ||
      sba7aWorkingCapitalProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.equipmentPurchaseAllowed)
        : false,
    businessCreditRequired: sbaExpressProduct
      ? Boolean(criteria.businessCreditRequired)
      : false,
    usOperatingBusinessRequired: sbaExpressProduct
      ? Boolean(criteria.usOperatingBusinessRequired)
      : false,
    startupEligible: sbaExpressProduct
      ? Boolean(criteria.startupEligible)
      : false,
    franchiseEligible:
      sbaExpressProduct || sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.franchiseEligible)
        : false,
    foreignOwnershipAllowed:
      sbaExpressProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? Boolean(criteria.foreignOwnershipAllowed)
        : false,
    bankruptcyAllowed:
      sbaExpressProduct ||
      residential1To4 ||
      rentalPortfolioProduct ||
      equipmentFinanceProduct ||
      sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.bankruptcyAllowed)
        : false,
    prepaymentPenalty: sbaExpressProduct || residential1To4
      ? Boolean(criteria.prepaymentPenalty)
      : false,
    minLiquidityRequirement:
      sba7aBusinessAcquisitionProduct &&
      criteria.minLiquidityRequirement?.trim()
        ? criteria.minLiquidityRequirement.trim()
        : null,
    minTimeInBusinessMonths:
      (sbaAcquisitionStyleProduct ||
        sba7aWorkingCapitalProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba7aRealEstateProduct ||
        sba504Product ||
        usdaBiProduct ||
        rentalPortfolioProduct ||
        equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct) &&
      criteria.minTimeInBusiness !== undefined &&
      criteria.minTimeInBusiness !== ""
        ? Number(criteria.minTimeInBusiness)
        : null,
    minAnnualRevenue:
      (sba7aWorkingCapitalProduct ||
        bridgeProduct ||
        equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        sba7aRealEstateProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba504Product ||
        usdaBiProduct) &&
      criteria.minAnnualRevenue !== undefined &&
      criteria.minAnnualRevenue !== ""
        ? Number(criteria.minAnnualRevenue)
        : null,
    maxFinancingPercent:
      sba7aWorkingCapitalProduct &&
      criteria.maxFinancingPercent !== undefined &&
      criteria.maxFinancingPercent !== ""
        ? Number(criteria.maxFinancingPercent)
        : null,
    useOfFunds:
      (sba7aWorkingCapitalProduct || sba504Product) &&
      criteria.useOfFunds?.trim()
        ? criteria.useOfFunds.trim()
        : null,
    collateralRequirements:
      (sba7aWorkingCapitalProduct || sba504Product) &&
      criteria.collateralRequirements?.trim()
        ? criteria.collateralRequirements.trim()
        : null,
    startupAllowed:
      sbaAcquisitionStyleProduct ||
      sba7aWorkingCapitalProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct ||
      equipmentFinanceProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? Boolean(criteria.startupAllowed)
        : false,
    rateStructure:
      sba504Product && criteria.rateStructure?.trim()
        ? criteria.rateStructure.trim()
        : null,
    refinanceAllowed:
      sbaExpressProduct ||
      sba504Product ||
      residential1To4 ||
      mezzOrPrefProduct ||
      sba7aWorkingCapitalProduct ||
      sba7aRealEstateProduct ||
      usdaBiProduct
        ? Boolean(criteria.refinanceAllowed)
        : false,
    workingCapitalEligible:
      sbaAcquisitionStyleProduct ||
      sba504Product ||
      equipmentFinanceProduct ||
      sba7aWorkingCapitalProduct ||
      sba7aRealEstateProduct ||
      sba7aEquipmentPurchaseProduct ||
      usdaBiProduct
        ? Boolean(criteria.workingCapitalEligible)
        : false,
    lifeInsuranceMayBeRequired: sba504Product
      ? Boolean(criteria.lifeInsuranceMayBeRequired)
      : false,
    lineOfCreditAvailable: sba7aWorkingCapitalProduct
      ? Boolean(criteria.lineOfCreditAvailable)
      : false,
    seasonalWorkingCapitalAllowed: sba7aWorkingCapitalProduct
      ? Boolean(criteria.seasonalWorkingCapitalAllowed)
      : false,
    accountsReceivableFinancingAllowed: sba7aWorkingCapitalProduct
      ? Boolean(criteria.accountsReceivableFinancingAllowed)
      : false,
    investmentPropertyAllowed: sba7aRealEstateProduct
      ? Boolean(criteria.investmentPropertyAllowed)
      : false,
    commercialRealEstateAllowed:
      sba7aRealEstateProduct || sba504Product || usdaBiProduct
        ? Boolean(criteria.commercialRealEstateAllowed)
        : false,
    usedEquipmentAllowed:
      sba7aEquipmentPurchaseProduct ||
      equipmentFinanceProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.usedEquipmentAllowed)
        : false,
    leaseholdImprovementsAllowed:
      sba7aEquipmentPurchaseProduct || usdaBiProduct
        ? Boolean(criteria.leaseholdImprovementsAllowed)
        : false,
    existingBusinessAllowed: sba7aEquipmentPurchaseProduct
      ? Boolean(criteria.existingBusinessAllowed)
      : false,
    saleLeasebackAvailable:
      sbaExpressProduct || equipmentFinanceProduct
        ? Boolean(criteria.saleLeasebackAvailable)
        : false,
    advanceRatePercent:
      (purchaseOrderProduct || arFactoringProduct || apSupplyChainProduct) &&
      ((criteria.minAdvanceRate !== undefined &&
        criteria.minAdvanceRate !== "") ||
        (criteria.advanceRate !== undefined && criteria.advanceRate !== ""))
        ? Number(
            criteria.minAdvanceRate !== undefined &&
              criteria.minAdvanceRate !== ""
              ? criteria.minAdvanceRate
              : criteria.advanceRate,
          )
        : null,
    maxAdvanceRatePercent:
      (arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct) &&
      criteria.maxAdvanceRate !== undefined &&
      criteria.maxAdvanceRate !== ""
        ? Number(criteria.maxAdvanceRate)
        : null,
    transactionFeePercent:
      purchaseOrderProduct &&
      criteria.transactionFee !== undefined &&
      criteria.transactionFee !== ""
        ? Number(criteria.transactionFee)
        : null,
    minGrossMarginPercent:
      purchaseOrderProduct &&
      criteria.minGrossMargin !== undefined &&
      criteria.minGrossMargin !== ""
        ? Number(criteria.minGrossMargin)
        : null,
    internationalPosAllowed: purchaseOrderProduct
      ? Boolean(criteria.internationalPosAllowed)
      : false,
    discountFeePercent:
      arFactoringProduct &&
      ((criteria.discountFee !== undefined && criteria.discountFee !== "") ||
        (criteria.minRate !== undefined && criteria.minRate !== ""))
        ? Number(
            criteria.discountFee !== undefined && criteria.discountFee !== ""
              ? criteria.discountFee
              : criteria.minRate,
          )
        : null,
    maxInvoiceAgeDays:
      (arFactoringProduct || apSupplyChainProduct) &&
      criteria.maxInvoiceAgeDays !== undefined &&
      criteria.maxInvoiceAgeDays !== ""
        ? Number(criteria.maxInvoiceAgeDays)
        : null,
    minInvoiceAgeDays:
      (arFactoringProduct || apSupplyChainProduct) &&
      criteria.minInvoiceAgeDays !== undefined &&
      criteria.minInvoiceAgeDays !== ""
        ? Number(criteria.minInvoiceAgeDays)
        : null,
    nonRecourseAvailable:
      arFactoringProduct || creStylePropertyProduct || rentalPortfolioProduct
        ? Boolean(criteria.nonRecourseAvailable)
        : false,
    governmentInvoicesOk: arFactoringProduct
      ? Boolean(criteria.governmentInvoicesOk)
      : false,
    earlyPaymentDiscountPercent:
      apSupplyChainProduct &&
      criteria.earlyPaymentDiscount !== undefined &&
      criteria.earlyPaymentDiscount !== ""
        ? Number(criteria.earlyPaymentDiscount)
        : null,
    paymentTermsExtensionDays:
      apSupplyChainProduct &&
      criteria.paymentTermsExtensionDays !== undefined &&
      criteria.paymentTermsExtensionDays !== ""
        ? Number(criteria.paymentTermsExtensionDays)
        : null,
    dynamicDiscountingAvailable: apSupplyChainProduct
      ? Boolean(criteria.dynamicDiscountingAvailable)
      : false,
    reverseFactoringAvailable: apSupplyChainProduct
      ? Boolean(criteria.reverseFactoringAvailable)
      : false,
    ownerOccupiedRequired:
      sbaExpressProduct || sba7aRealEstateProduct || sba504Product
        ? Boolean(criteria.ownerOccupiedRequired)
        : false,
    ownerOccupancyRequirement:
      (sba7aRealEstateProduct || sba504Product) &&
      criteria.ownerOccupancyRequirement?.trim()
        ? criteria.ownerOccupancyRequirement.trim()
        : null,
    environmentalReportRequired:
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct ||
      creStylePropertyProduct ||
      rentalPortfolioProduct
        ? Boolean(criteria.environmentalReportRequired)
        : false,
    appraisalRequired:
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct ||
      creStylePropertyProduct ||
      rentalPortfolioProduct
        ? Boolean(criteria.appraisalRequired)
        : false,
    maxTotalProjectAmount:
      sba504Product &&
      criteria.maxTotalProject !== undefined &&
      criteria.maxTotalProject !== ""
        ? Number(criteria.maxTotalProject)
        : null,
    maxSba504DebentureAmount:
      sba504Product &&
      criteria.maxSba504Debenture !== undefined &&
      criteria.maxSba504Debenture !== ""
        ? Number(criteria.maxSba504Debenture)
        : null,
    jobCreationRequired: sba504Product
      ? Boolean(criteria.jobCreationRequired)
      : false,
    maxUsdaGuaranteeAmount:
      usdaBiProduct &&
      criteria.maxUsdaGuarantee !== undefined &&
      criteria.maxUsdaGuarantee !== ""
        ? Number(criteria.maxUsdaGuarantee)
        : null,
    usdaGuaranteePercent:
      usdaBiProduct &&
      criteria.usdaGuaranteePercent !== undefined &&
      criteria.usdaGuaranteePercent !== ""
        ? Number(criteria.usdaGuaranteePercent)
        : null,
    ruralAreaRequired: usdaBiProduct
      ? Boolean(criteria.ruralAreaRequired)
      : false,
    preferredReturnPercent:
      preferredEquityProduct &&
      ((criteria.preferredReturn !== undefined &&
        criteria.preferredReturn !== "") ||
        (criteria.maxRate !== undefined && criteria.maxRate !== ""))
        ? Number(
            criteria.preferredReturn !== undefined &&
              criteria.preferredReturn !== ""
              ? criteria.preferredReturn
              : criteria.maxRate,
          )
        : null,
    maxArvPercent:
      (bridgeProduct ||
        constructionProduct ||
        (!dscrRentalProduct &&
          !rentalPortfolioProduct &&
          !crePermanentProduct &&
          !cmbsProduct &&
          !agencyMultifamilyProduct &&
          !mezzanineProduct &&
          !preferredEquityProduct &&
          !noPropertyMetricsProduct)) &&
      criteria.maxArv !== undefined &&
      criteria.maxArv !== ""
        ? Number(criteria.maxArv)
        : null,
    maxLtcPercent:
      criteria.maxLtc !== undefined && criteria.maxLtc !== ""
        ? Number(criteria.maxLtc)
        : null,
    minCreditScore:
      criteria.fico !== undefined && criteria.fico !== ""
        ? Number(criteria.fico)
        : null,
    minDscr:
      (bridgeProduct ||
        dscrRentalProduct ||
        rentalPortfolioProduct ||
        crePermanentProduct ||
        cmbsProduct ||
        agencyMultifamilyProduct ||
        mezzOrPrefProduct ||
        equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        isAnySba7aProduct(productCode) ||
        sba504Product ||
        usdaBiProduct) &&
      criteria.minDscr !== undefined &&
      criteria.minDscr !== ""
        ? Number(criteria.minDscr)
        : null,
    minDebtYieldPercent:
      (crePermanentProduct ||
        cmbsProduct ||
        agencyMultifamilyProduct ||
        mezzOrPrefProduct ||
        rentalPortfolioProduct) &&
      criteria.minDebtYield !== undefined &&
      criteria.minDebtYield !== ""
        ? Number(criteria.minDebtYield)
        : null,
    amortizationYears:
      sbaExpressProduct &&
      criteria.amortizationYears !== undefined &&
      criteria.amortizationYears !== ""
        ? Number(criteria.amortizationYears)
        : null,
    amortizationMonths:
      (crePermanentProduct ||
        agencyMultifamilyProduct ||
        cmbsProduct ||
        rentalPortfolioProduct) &&
      criteria.amortizationMonths !== undefined &&
      criteria.amortizationMonths !== ""
        ? Number(criteria.amortizationMonths)
        : null,
    minUnits:
      (agencyMultifamilyProduct || crePermanentProduct) &&
      criteria.minUnits !== undefined &&
      criteria.minUnits !== ""
        ? Number(criteria.minUnits)
        : null,
    maxUnits:
      (crePermanentProduct || agencyMultifamilyProduct) &&
      criteria.maxUnits !== undefined &&
      criteria.maxUnits !== ""
        ? Number(criteria.maxUnits)
        : null,
    prepaymentStructure:
      (sba7aWorkingCapitalProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba7aRealEstateProduct ||
        sba504Product) &&
      criteria.prepaymentStructure?.trim()
        ? criteria.prepaymentStructure.trim()
        : null,
    minPropertiesInPortfolio:
      rentalPortfolioProduct &&
      criteria.minProperties !== undefined &&
      criteria.minProperties !== ""
        ? Number(criteria.minProperties)
        : null,
    maxPropertiesInPortfolio:
      rentalPortfolioProduct &&
      criteria.maxProperties !== undefined &&
      criteria.maxProperties !== ""
        ? Number(criteria.maxProperties)
        : null,
    minExperience:
      criteria.experience !== undefined && criteria.experience !== ""
        ? String(criteria.experience)
        : null,
    interestRateRange:
      !isSba7aRateSpreadProduct(productCode) &&
      criteria.minRate &&
      criteria.maxRate
        ? `${criteria.minRate}-${criteria.maxRate}`
        : null,
    originationPointsPercent:
      criteria.originationPoints !== undefined &&
      criteria.originationPoints !== ""
        ? Number(criteria.originationPoints)
        : null,
    extensionAvailable: false,
    personalGuaranteeRequired:
      occupancyBorrowerFlags ||
      isAnySbaProduct(productCode) ||
      usdaBiProduct ||
      equipmentFinanceProduct ||
      arFactoringProduct ||
      apSupplyChainProduct ||
      purchaseOrderProduct
        ? Boolean(criteria.personalGuaranteeRequired)
        : false,
    firstTimeBorrowersAllowed: fixAndFlipProduct
      ? Boolean(criteria.firstTimeInvestorAllowed)
      : false,
    interestOnlyAvailable: occupancyBorrowerFlags
      ? Boolean(criteria.interestOnlyAvailable)
      : false,
    shortTermRentalsOk:
      dscrRentalProduct || bridgeProduct || rentalPortfolioProduct
        ? Boolean(criteria.shortTermRentalsOk)
        : false,
    foreignNationalsAllowed:
      occupancyBorrowerFlags ||
      equipmentFinanceProduct ||
      sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.foreignNationalsAllowed)
        : false,
    minPropertyValueAmount:
      (bridgeProduct || creStylePropertyProduct || rentalPortfolioProduct) &&
      criteria.minPropertyValue !== undefined &&
      criteria.minPropertyValue !== ""
        ? Number(criteria.minPropertyValue)
        : null,
    maxPropertyValueAmount:
      (bridgeProduct || creStylePropertyProduct || rentalPortfolioProduct) &&
      criteria.maxPropertyValue !== undefined &&
      criteria.maxPropertyValue !== ""
        ? Number(criteria.maxPropertyValue)
        : null,
    unit1Allowed: residential1To4 ? Boolean(criteria.unit1Allowed) : false,
    unit2Allowed: residential1To4 ? Boolean(criteria.unit2Allowed) : false,
    unit3Allowed: residential1To4 ? Boolean(criteria.unit3Allowed) : false,
    unit4Allowed: residential1To4 ? Boolean(criteria.unit4Allowed) : false,
    ownerOccupiedAllowed:
      occupancyBorrowerFlags ||
      sba7aRealEstateProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.ownerOccupiedAllowed)
        : false,
    nonOwnerOccupiedAllowed: occupancyBorrowerFlags
      ? Boolean(criteria.nonOwnerOccupiedAllowed)
      : false,
    purchaseAllowed:
      occupancyBorrowerFlags || sba7aRealEstateProduct
        ? Boolean(criteria.purchaseAllowed)
        : false,
    cashOutRefinanceAllowed:
      occupancyBorrowerFlags ||
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.cashOutRefinanceAllowed)
        : false,
    renovationAllowed:
      bridgeProduct ||
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.renovationAllowed)
        : false,
    heavyRehabAllowed:
      bridgeProduct || fixAndFlipProduct
        ? Boolean(criteria.heavyRehabAllowed)
        : false,
    lightRehabAllowed:
      bridgeProduct || fixAndFlipProduct || rentalPortfolioProduct
        ? Boolean(criteria.lightRehabAllowed)
        : false,
    vacantPropertyAllowed:
      residential1To4 || rentalPortfolioProduct
        ? Boolean(criteria.vacantPropertyAllowed)
        : false,
    tenantOccupiedAllowed: bridgeProduct
      ? Boolean(criteria.tenantOccupiedAllowed)
      : false,
    foreclosureReoAllowed:
      bridgeProduct || fixAndFlipProduct
        ? Boolean(criteria.foreclosureReoAllowed)
        : false,
    llcEntityBorrowerAllowed:
      occupancyBorrowerFlags || equipmentFinanceProduct
        ? Boolean(criteria.llcEntityBorrowerAllowed)
        : false,
    propertyTypesExcluded:
      occupancyBorrowerFlags && criteria.propertyTypesExcluded?.trim()
        ? criteria.propertyTypesExcluded.trim()
        : null,
    maxLtvCashOutPercent:
      dscrRentalProduct &&
      criteria.maxLtvCashOut !== undefined &&
      criteria.maxLtvCashOut !== ""
        ? Number(criteria.maxLtvCashOut)
        : null,
    minRentalIncomeAmount:
      dscrRentalProduct &&
      criteria.minRentalIncome !== undefined &&
      criteria.minRentalIncome !== ""
        ? Number(criteria.minRentalIncome)
        : null,
    rentalIncomeRequired: dscrRentalProduct
      ? Boolean(criteria.rentalIncomeRequired)
      : false,
    longTermRentalAllowed:
      dscrRentalProduct || rentalPortfolioProduct
        ? Boolean(criteria.longTermRentalAllowed)
        : false,
    leaseRequired:
      dscrRentalProduct || rentalPortfolioProduct
        ? Boolean(criteria.leaseRequired)
        : false,
    marketRentScheduleAccepted:
      dscrRentalProduct || rentalPortfolioProduct
        ? Boolean(criteria.marketRentScheduleAccepted)
        : false,
    firstTimeInvestorAllowed:
      dscrRentalProduct || fixAndFlipProduct || rentalPortfolioProduct
        ? Boolean(criteria.firstTimeInvestorAllowed)
        : false,
    foreclosureShortSaleAllowed:
      dscrRentalProduct || rentalPortfolioProduct
        ? Boolean(criteria.foreclosureShortSaleAllowed)
        : false,
    minInvestorExperienceDeals:
      fixAndFlipProduct &&
      criteria.minInvestorExperienceDeals !== undefined &&
      criteria.minInvestorExperienceDeals !== ""
        ? Number(criteria.minInvestorExperienceDeals)
        : null,
    moderateRehabAllowed: fixAndFlipProduct
      ? Boolean(criteria.moderateRehabAllowed)
      : false,
    groundUpConstructionAllowed:
      fixAndFlipProduct ||
      constructionProduct ||
      mezzOrPrefProduct ||
      cmbsProduct ||
      sba7aRealEstateProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.groundUpConstructionAllowed)
        : false,
    shortSaleAllowed: fixAndFlipProduct
      ? Boolean(criteria.shortSaleAllowed)
      : false,
    borrowerExperienceRequired: fixAndFlipProduct
      ? Boolean(criteria.borrowerExperienceRequired)
      : false,
    rehabFundsFinanced: fixAndFlipProduct
      ? Boolean(criteria.rehabFundsFinanced)
      : false,
    rehabFundsMaxPercent:
      fixAndFlipProduct &&
      criteria.rehabFundsMaxPercent !== undefined &&
      criteria.rehabFundsMaxPercent !== ""
        ? Number(criteria.rehabFundsMaxPercent)
        : null,
    drawScheduleRequired:
      fixAndFlipProduct || constructionProduct
        ? Boolean(criteria.drawScheduleRequired)
        : false,
    gcRequired: constructionProduct ? Boolean(criteria.gcRequired) : false,
    completionGuaranteeRequired:
      constructionProduct || mezzOrPrefProduct
        ? Boolean(criteria.completionGuaranteeRequired)
        : false,
    minConstructionProjectsCompleted:
      constructionProduct &&
      criteria.minConstructionProjectsCompleted !== undefined &&
      criteria.minConstructionProjectsCompleted !== ""
        ? Number(criteria.minConstructionProjectsCompleted)
        : null,
    tearDownRebuildAllowed: constructionProduct
      ? Boolean(criteria.tearDownRebuildAllowed)
      : false,
    majorRenovationAllowed: constructionProduct
      ? Boolean(criteria.majorRenovationAllowed)
      : false,
    constructionToPermanentAllowed: constructionProduct
      ? Boolean(criteria.constructionToPermanentAllowed)
      : false,
    lotPurchaseIncluded: constructionProduct
      ? Boolean(criteria.lotPurchaseIncluded)
      : false,
    landAlreadyOwnedAllowed: constructionProduct
      ? Boolean(criteria.landAlreadyOwnedAllowed)
      : false,
    landEquityAllowed: constructionProduct
      ? Boolean(criteria.landEquityAllowed)
      : false,
    softCostsFinanced:
      constructionProduct ||
      equipmentFinanceProduct ||
      sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.softCostsFinanced)
        : false,
    hardCostsFinanced: constructionProduct
      ? Boolean(criteria.hardCostsFinanced)
      : false,
    contingencyFinanced: constructionProduct
      ? Boolean(criteria.contingencyFinanced)
      : false,
    interestReserveFinanced: constructionProduct
      ? Boolean(criteria.interestReserveFinanced)
      : false,
    ownerBuilderAllowed: constructionProduct
      ? Boolean(criteria.ownerBuilderAllowed)
      : false,
    firstTimeBuilderAllowed: constructionProduct
      ? Boolean(criteria.firstTimeBuilderAllowed)
      : false,
    inspectionRequiredForDraws: constructionProduct
      ? Boolean(criteria.inspectionRequiredForDraws)
      : false,
    minOwnershipExperienceYears:
      creStylePropertyProduct &&
      criteria.minOwnershipExperienceYears !== undefined &&
      criteria.minOwnershipExperienceYears !== ""
        ? Number(criteria.minOwnershipExperienceYears)
        : null,
    rateTermRefinanceAllowed:
      crePermanentProduct ||
      agencyMultifamilyProduct ||
      cmbsProduct ||
      rentalPortfolioProduct
        ? Boolean(criteria.rateTermRefinanceAllowed)
        : false,
    multifamily5PlusAllowed:
      creStylePropertyProduct ||
      rentalPortfolioProduct ||
      sba7aRealEstateProduct ||
      usdaBiProduct
        ? Boolean(criteria.multifamily5PlusAllowed)
        : false,
    apartmentAllowed:
      crePermanentProduct || cmbsProduct
        ? Boolean(criteria.apartmentAllowed)
        : false,
    officeAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.officeAllowed)
        : false,
    retailAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.retailAllowed)
        : false,
    industrialAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.industrialAllowed)
        : false,
    mixedUseAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.mixedUseAllowed)
        : false,
    selfStorageAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.selfStorageAllowed)
        : false,
    hotelHospitalityAllowed:
      crePermanentProduct || mezzOrPrefProduct || cmbsProduct
        ? Boolean(criteria.hotelHospitalityAllowed)
        : false,
    medicalHealthcareAllowed:
      crePermanentProduct || cmbsProduct
        ? Boolean(criteria.medicalHealthcareAllowed)
        : false,
    studentHousingAllowed: creStylePropertyProduct
      ? Boolean(criteria.studentHousingAllowed)
      : false,
    mobileHomeParkAllowed:
      crePermanentProduct || cmbsProduct
        ? Boolean(criteria.mobileHomeParkAllowed)
        : false,
    seniorHousingAllowed: creStylePropertyProduct
      ? Boolean(criteria.seniorHousingAllowed)
      : false,
    minOccupancyPercent:
      (creStylePropertyProduct || rentalPortfolioProduct) &&
      criteria.minOccupancy !== undefined &&
      criteria.minOccupancy !== ""
        ? Number(criteria.minOccupancy)
        : null,
    minAnnualNoiAmount:
      creStylePropertyProduct &&
      criteria.minAnnualNoi !== undefined &&
      criteria.minAnnualNoi !== ""
        ? Number(criteria.minAnnualNoi)
        : null,
    stabilizedPropertyRequired: creStylePropertyProduct
      ? Boolean(criteria.stabilizedPropertyRequired)
      : false,
    leaseUpPropertiesAccepted: creStylePropertyProduct
      ? Boolean(criteria.leaseUpPropertiesAccepted)
      : false,
    valueAddPropertiesAccepted:
      creStylePropertyProduct || rentalPortfolioProduct
        ? Boolean(criteria.valueAddPropertiesAccepted)
        : false,
    newlyRenovatedPropertiesAllowed: crePermanentProduct
      ? Boolean(criteria.newlyRenovatedPropertiesAllowed)
      : false,
    propertyConditionAssessmentRequired:
      creStylePropertyProduct || rentalPortfolioProduct
        ? Boolean(criteria.propertyConditionAssessmentRequired)
        : false,
    agencyProgram:
      agencyMultifamilyProduct && criteria.agencyProgram?.trim()
        ? String(criteria.agencyProgram).trim()
        : null,
    supplementalFinancingAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.supplementalFinancingAllowed)
      : false,
    marketRateMultifamilyAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.marketRateMultifamilyAllowed)
      : false,
    affordableHousingAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.affordableHousingAllowed)
      : false,
    cooperativeHousingAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.cooperativeHousingAllowed)
      : false,
    manufacturedHousingCommunityAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.manufacturedHousingCommunityAllowed)
      : false,
    smallBalanceMultifamilyAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.smallBalanceMultifamilyAllowed)
      : false,
    minDscrFixedRate:
      agencyMultifamilyProduct &&
      criteria.minDscrFixedRate !== undefined &&
      criteria.minDscrFixedRate !== ""
        ? Number(criteria.minDscrFixedRate)
        : null,
    minDscrArm:
      agencyMultifamilyProduct &&
      criteria.minDscrArm !== undefined &&
      criteria.minDscrArm !== ""
        ? Number(criteria.minDscrArm)
        : null,
    newConstructionAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.newConstructionAllowed)
      : false,
    renovationModerateRehabAllowed: agencyMultifamilyProduct
      ? Boolean(criteria.renovationModerateRehabAllowed)
      : false,
    mezzPreferredFinancingType:
      mezzOrPrefProduct && criteria.mezzPreferredFinancingType?.trim()
        ? String(criteria.mezzPreferredFinancingType).trim()
        : null,
    acquisitionFinancingAllowed: mezzOrPrefProduct
      ? Boolean(criteria.acquisitionFinancingAllowed)
      : false,
    constructionFinancingAllowed: mezzOrPrefProduct
      ? Boolean(criteria.constructionFinancingAllowed)
      : false,
    bridgeFinancingAllowed: mezzOrPrefProduct
      ? Boolean(criteria.bridgeFinancingAllowed)
      : false,
    valueAddFinancingAllowed: mezzOrPrefProduct
      ? Boolean(criteria.valueAddFinancingAllowed)
      : false,
    recapitalizationAllowed: mezzOrPrefProduct
      ? Boolean(criteria.recapitalizationAllowed)
      : false,
    equityGapFinancingAllowed: mezzOrPrefProduct
      ? Boolean(criteria.equityGapFinancingAllowed)
      : false,
    maxStabilizedLtvPercent:
      mezzOrPrefProduct &&
      criteria.maxStabilizedLtv !== undefined &&
      criteria.maxStabilizedLtv !== ""
        ? Number(criteria.maxStabilizedLtv)
        : null,
    debtRefinanceAllowed: cmbsProduct
      ? Boolean(criteria.debtRefinanceAllowed)
      : false,
    minLoanSizeForPropertyTypeAmount:
      cmbsProduct &&
      criteria.minLoanSizeForPropertyType !== undefined &&
      criteria.minLoanSizeForPropertyType !== ""
        ? Number(criteria.minLoanSizeForPropertyType)
        : null,
    badBoyGuaranteeRequired: cmbsProduct
      ? Boolean(criteria.badBoyGuaranteeRequired)
      : false,
    springingRecourseAllowed: cmbsProduct
      ? Boolean(criteria.springingRecourseAllowed)
      : false,
    defeasanceAllowed: cmbsProduct
      ? Boolean(criteria.defeasanceAllowed)
      : false,
    yieldMaintenanceAllowed: cmbsProduct
      ? Boolean(criteria.yieldMaintenanceAllowed)
      : false,
    interestOnlyPeriodMonths:
      cmbsProduct &&
      criteria.interestOnlyPeriodMonths !== undefined &&
      criteria.interestOnlyPeriodMonths !== ""
        ? Number(criteria.interestOnlyPeriodMonths)
        : null,
    portfolioRefinanceAllowed: rentalPortfolioProduct
      ? Boolean(criteria.portfolioRefinanceAllowed)
      : false,
    crossCollateralizationAllowed: rentalPortfolioProduct
      ? Boolean(criteria.crossCollateralizationAllowed)
      : false,
    residential1To4Allowed: rentalPortfolioProduct
      ? Boolean(criteria.residential1To4Allowed)
      : false,
    minPortfolioValueAmount:
      rentalPortfolioProduct &&
      criteria.minPortfolioValue !== undefined &&
      criteria.minPortfolioValue !== ""
        ? Number(criteria.minPortfolioValue)
        : null,
    maxPortfolioValueAmount:
      rentalPortfolioProduct &&
      criteria.maxPortfolioValue !== undefined &&
      criteria.maxPortfolioValue !== ""
        ? Number(criteria.maxPortfolioValue)
        : null,
    minPortfolioNoiAmount:
      rentalPortfolioProduct &&
      criteria.minPortfolioNoi !== undefined &&
      criteria.minPortfolioNoi !== ""
        ? Number(criteria.minPortfolioNoi)
        : null,
    minPortfolioRentalIncomeAmount:
      rentalPortfolioProduct &&
      criteria.minPortfolioRentalIncome !== undefined &&
      criteria.minPortfolioRentalIncome !== ""
        ? Number(criteria.minPortfolioRentalIncome)
        : null,
    minCashReservesAmount:
      rentalPortfolioProduct &&
      criteria.minCashReserves !== undefined &&
      criteria.minCashReserves !== ""
        ? Number(criteria.minCashReserves)
        : null,
    minMonthsReserves:
      rentalPortfolioProduct &&
      criteria.minMonthsReserves !== undefined &&
      criteria.minMonthsReserves !== ""
        ? Number(criteria.minMonthsReserves)
        : null,
    minEbitdaAmount:
      (equipmentFinanceProduct ||
        sba7aWorkingCapitalProduct ||
        sba7aRealEstateProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba504Product ||
        usdaBiProduct) &&
      criteria.minEbitda !== undefined &&
      criteria.minEbitda !== ""
        ? Number(criteria.minEbitda)
        : null,
    newEquipmentAllowed:
      equipmentFinanceProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product ||
      usdaBiProduct
        ? Boolean(criteria.newEquipmentAllowed)
        : false,
    equipmentRefinanceAllowed:
      equipmentFinanceProduct || sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.equipmentRefinanceAllowed)
        : false,
    equipmentLeaseAllowed: equipmentFinanceProduct
      ? Boolean(criteria.equipmentLeaseAllowed)
      : false,
    leaseToOwnAllowed: equipmentFinanceProduct
      ? Boolean(criteria.leaseToOwnAllowed)
      : false,
    installationCostsFinanced:
      equipmentFinanceProduct || sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.installationCostsFinanced)
        : false,
    transportationFreightCostsFinanced: equipmentFinanceProduct
      ? Boolean(criteria.transportationFreightCostsFinanced)
      : false,
    firstTimeBusinessOwnersAllowed: equipmentFinanceProduct
      ? Boolean(criteria.firstTimeBusinessOwnersAllowed)
      : false,
    minEquipmentValueAmount:
      (equipmentFinanceProduct || sba7aEquipmentPurchaseProduct) &&
      criteria.minEquipmentValue !== undefined &&
      criteria.minEquipmentValue !== ""
        ? Number(criteria.minEquipmentValue)
        : null,
    maxEquipmentValueAmount:
      (equipmentFinanceProduct || sba7aEquipmentPurchaseProduct) &&
      criteria.maxEquipmentValue !== undefined &&
      criteria.maxEquipmentValue !== ""
        ? Number(criteria.maxEquipmentValue)
        : null,
    maxEquipmentAgeYears:
      (equipmentFinanceProduct || sba7aEquipmentPurchaseProduct) &&
      criteria.maxEquipmentAgeYears !== undefined &&
      criteria.maxEquipmentAgeYears !== ""
        ? Number(criteria.maxEquipmentAgeYears)
        : null,
    minUsefulLifeRemainingYears:
      (equipmentFinanceProduct || sba7aEquipmentPurchaseProduct) &&
      criteria.minUsefulLifeRemainingYears !== undefined &&
      criteria.minUsefulLifeRemainingYears !== ""
        ? Number(criteria.minUsefulLifeRemainingYears)
        : null,
    equipmentAppraisalRequired:
      equipmentFinanceProduct || sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.equipmentAppraisalRequired)
        : false,
    vendorInvoiceRequired:
      equipmentFinanceProduct || sba7aEquipmentPurchaseProduct
        ? Boolean(criteria.vendorInvoiceRequired)
        : false,
    equipmentTypesExcluded:
      (equipmentFinanceProduct || sba7aEquipmentPurchaseProduct) &&
      criteria.equipmentTypesExcluded?.trim()
        ? criteria.equipmentTypesExcluded.trim()
        : null,
    industriesExcluded:
      (equipmentFinanceProduct ||
        arFactoringProduct ||
        apSupplyChainProduct ||
        purchaseOrderProduct ||
        sba7aWorkingCapitalProduct ||
        sba7aRealEstateProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba504Product ||
        usdaBiProduct) &&
      criteria.industriesExcluded?.trim()
        ? criteria.industriesExcluded.trim()
        : null,
    minMonthlyArAmount:
      arFactoringProduct &&
      criteria.minMonthlyAr !== undefined &&
      criteria.minMonthlyAr !== ""
        ? Number(criteria.minMonthlyAr)
        : null,
    recourseFactoringAllowed: arFactoringProduct
      ? Boolean(criteria.recourseFactoringAllowed)
      : false,
    invoiceFactoringAllowed: arFactoringProduct
      ? Boolean(criteria.invoiceFactoringAllowed)
      : false,
    arLineOfCreditAllowed: arFactoringProduct
      ? Boolean(criteria.arLineOfCreditAllowed)
      : false,
    assetBasedLendingAllowed: arFactoringProduct
      ? Boolean(criteria.assetBasedLendingAllowed)
      : false,
    purchaseOrderFinancingAllowed:
      arFactoringProduct || apSupplyChainProduct
        ? Boolean(criteria.purchaseOrderFinancingAllowed)
        : false,
    domesticArAllowed: arFactoringProduct
      ? Boolean(criteria.domesticArAllowed)
      : false,
    internationalArAllowed: arFactoringProduct
      ? Boolean(criteria.internationalArAllowed)
      : false,
    b2bReceivablesAllowed:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.b2bReceivablesAllowed)
        : false,
    b2cReceivablesAllowed:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.b2cReceivablesAllowed)
        : false,
    concentrationLimitPercent:
      arFactoringProduct &&
      criteria.concentrationLimit !== undefined &&
      criteria.concentrationLimit !== ""
        ? Number(criteria.concentrationLimit)
        : null,
    minInvoiceSizeAmount:
      (arFactoringProduct || apSupplyChainProduct) &&
      criteria.minInvoiceSize !== undefined &&
      criteria.minInvoiceSize !== ""
        ? Number(criteria.minInvoiceSize)
        : null,
    maxInvoiceSizeAmount:
      (arFactoringProduct || apSupplyChainProduct) &&
      criteria.maxInvoiceSize !== undefined &&
      criteria.maxInvoiceSize !== ""
        ? Number(criteria.maxInvoiceSize)
        : null,
    maxInvoiceDilutionPercent:
      arFactoringProduct &&
      criteria.maxInvoiceDilution !== undefined &&
      criteria.maxInvoiceDilution !== ""
        ? Number(criteria.maxInvoiceDilution)
        : null,
    minDebtorCreditScore:
      arFactoringProduct &&
      criteria.minDebtorCreditScore !== undefined &&
      criteria.minDebtorCreditScore !== ""
        ? Number(criteria.minDebtorCreditScore)
        : null,
    customerCreditInsuranceRequired: arFactoringProduct
      ? Boolean(criteria.customerCreditInsuranceRequired)
      : false,
    existingLiensAccepted:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.existingLiensAccepted)
        : false,
    taxLiensAccepted:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.taxLiensAccepted)
        : false,
    uccFilingRequired:
      arFactoringProduct || apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.uccFilingRequired)
        : false,
    minEligibleArAmount:
      arFactoringProduct &&
      criteria.minEligibleAr !== undefined &&
      criteria.minEligibleAr !== ""
        ? Number(criteria.minEligibleAr)
        : null,
    maxArConcentrationPercent:
      arFactoringProduct &&
      criteria.maxArConcentration !== undefined &&
      criteria.maxArConcentration !== ""
        ? Number(criteria.maxArConcentration)
        : null,
    minMonthlyPayablesAmount:
      apSupplyChainProduct &&
      criteria.minMonthlyPayables !== undefined &&
      criteria.minMonthlyPayables !== ""
        ? Number(criteria.minMonthlyPayables)
        : null,
    vendorSupplierFinancingAllowed: apSupplyChainProduct
      ? Boolean(criteria.vendorSupplierFinancingAllowed)
      : false,
    tradePayablesFinancingAllowed: apSupplyChainProduct
      ? Boolean(criteria.tradePayablesFinancingAllowed)
      : false,
    inventoryFinancingAllowed:
      apSupplyChainProduct || sba7aWorkingCapitalProduct || usdaBiProduct
        ? Boolean(criteria.inventoryFinancingAllowed)
        : false,
    supplyChainFinanceAllowed: apSupplyChainProduct
      ? Boolean(criteria.supplyChainFinanceAllowed)
      : false,
    domesticVendorsAllowed: apSupplyChainProduct
      ? Boolean(criteria.domesticVendorsAllowed)
      : false,
    internationalVendorsAllowed: apSupplyChainProduct
      ? Boolean(criteria.internationalVendorsAllowed)
      : false,
    governmentContractorsAllowed: apSupplyChainProduct
      ? Boolean(criteria.governmentContractorsAllowed)
      : false,
    maxVendorConcentrationPercent:
      apSupplyChainProduct &&
      criteria.maxVendorConcentration !== undefined &&
      criteria.maxVendorConcentration !== ""
        ? Number(criteria.maxVendorConcentration)
        : null,
    minVendorCreditQuality:
      apSupplyChainProduct && criteria.minVendorCreditQuality?.trim()
        ? criteria.minVendorCreditQuality.trim()
        : null,
    vendorVerificationRequired:
      apSupplyChainProduct || purchaseOrderProduct
        ? Boolean(criteria.vendorVerificationRequired)
        : false,
    purchaseOrderRequired: apSupplyChainProduct
      ? Boolean(criteria.purchaseOrderRequired)
      : false,
    minEligiblePayablesAmount:
      apSupplyChainProduct &&
      criteria.minEligiblePayables !== undefined &&
      criteria.minEligiblePayables !== ""
        ? Number(criteria.minEligiblePayables)
        : null,
    maxPayablesConcentrationPercent:
      apSupplyChainProduct &&
      criteria.maxPayablesConcentration !== undefined &&
      criteria.maxPayablesConcentration !== ""
        ? Number(criteria.maxPayablesConcentration)
        : null,
    domesticPosAllowed: purchaseOrderProduct
      ? Boolean(criteria.domesticPosAllowed)
      : false,
    governmentPosAllowed: purchaseOrderProduct
      ? Boolean(criteria.governmentPosAllowed)
      : false,
    recurringPosAllowed: purchaseOrderProduct
      ? Boolean(criteria.recurringPosAllowed)
      : false,
    oneTimePosAllowed: purchaseOrderProduct
      ? Boolean(criteria.oneTimePosAllowed)
      : false,
    manufacturingRequired: purchaseOrderProduct
      ? Boolean(criteria.manufacturingRequired)
      : false,
    finishedGoodsAllowed: purchaseOrderProduct
      ? Boolean(criteria.finishedGoodsAllowed)
      : false,
    rawMaterialsAllowed: purchaseOrderProduct
      ? Boolean(criteria.rawMaterialsAllowed)
      : false,
    supplierVendorPaymentAllowed: purchaseOrderProduct
      ? Boolean(criteria.supplierVendorPaymentAllowed)
      : false,
    purchaseOrderAssignmentAllowed: purchaseOrderProduct
      ? Boolean(criteria.purchaseOrderAssignmentAllowed)
      : false,
    minPoAmountAmount:
      purchaseOrderProduct &&
      criteria.minPoAmount !== undefined &&
      criteria.minPoAmount !== ""
        ? Number(criteria.minPoAmount)
        : null,
    maxPoAmountAmount:
      purchaseOrderProduct &&
      criteria.maxPoAmount !== undefined &&
      criteria.maxPoAmount !== ""
        ? Number(criteria.maxPoAmount)
        : null,
    minCustomerCreditScore:
      purchaseOrderProduct &&
      criteria.minCustomerCreditScore !== undefined &&
      criteria.minCustomerCreditScore !== ""
        ? Number(criteria.minCustomerCreditScore)
        : null,
    minCustomerCreditRating:
      purchaseOrderProduct && criteria.minCustomerCreditRating?.trim()
        ? criteria.minCustomerCreditRating.trim()
        : null,
    maxCustomerConcentrationPercent:
      purchaseOrderProduct &&
      criteria.maxCustomerConcentration !== undefined &&
      criteria.maxCustomerConcentration !== ""
        ? Number(criteria.maxCustomerConcentration)
        : null,
    minGrossProfitMarginPercent:
      purchaseOrderProduct &&
      criteria.minGrossProfitMargin !== undefined &&
      criteria.minGrossProfitMargin !== ""
        ? Number(criteria.minGrossProfitMargin)
        : null,
    minCustomerDepositPercent:
      purchaseOrderProduct &&
      criteria.minCustomerDeposit !== undefined &&
      criteria.minCustomerDeposit !== ""
        ? Number(criteria.minCustomerDeposit)
        : null,
    customerVerificationRequired: purchaseOrderProduct
      ? Boolean(criteria.customerVerificationRequired)
      : false,
    minEligiblePoValueAmount:
      purchaseOrderProduct &&
      criteria.minEligiblePoValue !== undefined &&
      criteria.minEligiblePoValue !== ""
        ? Number(criteria.minEligiblePoValue)
        : null,
    maxPoConcentrationPercent:
      purchaseOrderProduct &&
      criteria.maxPoConcentration !== undefined &&
      criteria.maxPoConcentration !== ""
        ? Number(criteria.maxPoConcentration)
        : null,
    criteriaNotes: criteria.criteriaNotes?.trim() || null,
    statesSupported: criteria.states || [],
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null),
  );
};

const normalizeDocumentsForForm = (product: any) => {
  const raw =
    product?.lenderDocumentRequirements || product?.documents || [];

  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((doc: any) => {
      const documentTypeId =
        doc.documentTypeId || doc.documentType?.id || doc.id;
      if (!documentTypeId) return null;

      return {
        ...doc,
        id: documentTypeId,
        documentTypeId,
        name:
          doc.documentName ||
          doc.documentType?.name ||
          doc.name ||
          null,
      };
    })
    .filter(Boolean);
};

const apiToFormValue = (val: unknown) => {
  if (val === null || val === undefined) return "";

  if (typeof val === "number") {
    return Number.isFinite(val) ? String(val) : "";
  }

  if (typeof val === "boolean") {
    return val ? "true" : "";
  }

  if (typeof val === "object") {
    if (typeof (val as { toString?: () => string }).toString === "function") {
      const str = (val as { toString: () => string }).toString();
      if (str && str !== "[object Object]") return str;
    }
    return "";
  }

  return String(val);
};

const parseInterestRateRange = (range: unknown) => {
  if (range === null || range === undefined || range === "") {
    return { minRate: "", maxRate: "" };
  }

  if (typeof range === "number" && Number.isFinite(range)) {
    const value = String(range);
    return { minRate: value, maxRate: value };
  }

  if (typeof range !== "string") {
    return { minRate: "", maxRate: "" };
  }

  const clean = (part: string) =>
    part.replace(/,/g, "").replace(/%/g, "").trim();

  const stripped = range.replace(/%/g, "").trim();
  const numericRange = stripped.match(
    /^([\d.]+)\s*(?:-|–|—|\sto\s)\s*([\d.]+)$/i,
  );

  if (numericRange) {
    return {
      minRate: clean(numericRange[1]),
      maxRate: clean(numericRange[2]),
    };
  }

  const singleValue = stripped.match(/^([\d.]+)$/);
  if (singleValue) {
    return {
      minRate: clean(singleValue[1]),
      maxRate: clean(singleValue[1]),
    };
  }

  return { minRate: "", maxRate: "" };
};

const resolveFormInterestRates = (product: any) => {
  const fromRange = parseInterestRateRange(product.interestRateRange);
  if (fromRange.minRate || fromRange.maxRate) {
    return fromRange;
  }

  const minSpread = apiToFormValue(product.minRateSpreadPercent);
  const maxSpread = apiToFormValue(product.maxRateSpreadPercent);
  if (minSpread || maxSpread) {
    return { minRate: minSpread, maxRate: maxSpread };
  }

  const discount = apiToFormValue(product.discountFeePercent);
  if (discount) {
    return { minRate: discount, maxRate: discount };
  }

  return { minRate: "", maxRate: "" };
};

export const mapApiProductToCriteriaForm = (product: any) => {
  const productCode = resolveLenderOfferedProductCode(
    product.loanProductCode || product.code || product.loanProduct?.code || "",
  );
  const toFormValue = apiToFormValue;
  const toFormBoolean = (val: unknown) => val === true;
  const interestRates = resolveFormInterestRates(product);

  return {
    minLoan: toFormValue(product.minLoanAmount),
    maxLoan: toFormValue(product.maxLoanAmount),
    minFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode) ||
      isApSupplyChainProduct(productCode)
        ? toFormValue(product.minLoanAmount)
        : "",
    maxFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode) ||
      isApSupplyChainProduct(productCode)
        ? toFormValue(product.maxLoanAmount)
        : "",
    minProgramSize: isApSupplyChainProduct(productCode)
      ? toFormValue(product.minLoanAmount)
      : "",
    maxProgramSize: isApSupplyChainProduct(productCode)
      ? toFormValue(product.maxLoanAmount)
      : "",
    minTerm: fromTermMonths(product.minTermMonths, productCode),
    maxTerm: fromTermMonths(product.maxTermMonths, productCode),
    maxRateSpread: toFormValue(product.maxRateSpreadPercent),
    minRateSpread: toFormValue(product.minRateSpreadPercent),
    sbaGuaranteePercent: toFormValue(product.sbaGuaranteePercent),
    avgTurnaroundDays: toFormValue(product.avgTurnaroundDays),
    preferredLenderPlp: toFormBoolean(product.preferredLenderPlp),
    requiredInjection: toFormValue(product.requiredInjectionPercent),
    goodwillFinancingAllowed: toFormBoolean(product.goodwillFinancingAllowed),
    sellerFinancingAllowed: toFormBoolean(product.sellerFinancingAllowed),
    intangibleAssetsAllowed: toFormBoolean(product.intangibleAssetsAllowed),
    equipmentIncluded: toFormBoolean(product.equipmentIncluded),
    realEstateIncluded: toFormBoolean(product.realEstateIncluded),
    franchiseAcquisitionAllowed: toFormBoolean(
      product.franchiseAcquisitionAllowed,
    ),
    collateralRequired: toFormBoolean(product.collateralRequired),
    collateralAsDownPaymentAllowed: toFormBoolean(
      product.collateralAsDownPaymentAllowed,
    ),
    preferredDscr: toFormValue(product.preferredDscr),
    maxTermRealEstate: toFormValue(product.maxTermRealEstateMonths),
    maxTermEquipment: toFormValue(product.maxTermEquipmentMonths),
    maxTermWorkingCapital: toFormValue(product.maxTermWorkingCapitalMonths),
    maximumDebtService: toFormValue(product.maximumDebtService),
    businessAcquisitionAllowed: toFormBoolean(
      product.businessAcquisitionAllowed,
    ),
    equipmentPurchaseAllowed: toFormBoolean(product.equipmentPurchaseAllowed),
    businessCreditRequired: toFormBoolean(product.businessCreditRequired),
    usOperatingBusinessRequired: toFormBoolean(
      product.usOperatingBusinessRequired,
    ),
    startupEligible: toFormBoolean(product.startupEligible),
    franchiseEligible: toFormBoolean(product.franchiseEligible),
    foreignOwnershipAllowed: toFormBoolean(product.foreignOwnershipAllowed),
    bankruptcyAllowed: toFormBoolean(product.bankruptcyAllowed),
    prepaymentPenalty: toFormBoolean(product.prepaymentPenalty),
    minLiquidityRequirement: product.minLiquidityRequirement ?? "",
    minTimeInBusiness: toFormValue(product.minTimeInBusinessMonths),
    minAnnualRevenue: toFormValue(product.minAnnualRevenue),
    maxFinancingPercent: toFormValue(product.maxFinancingPercent),
    useOfFunds: product.useOfFunds ?? "",
    collateralRequirements: product.collateralRequirements ?? "",
    startupAllowed: toFormBoolean(product.startupAllowed),
    rateStructure: product.rateStructure ?? "",
    refinanceAllowed: toFormBoolean(product.refinanceAllowed),
    workingCapitalEligible: toFormBoolean(product.workingCapitalEligible),
    lifeInsuranceMayBeRequired: toFormBoolean(product.lifeInsuranceMayBeRequired),
    interestRateNote: isSba504Product(productCode)
      ? (product.interestRateRange ?? "")
      : "",
    lineOfCreditAvailable: toFormBoolean(product.lineOfCreditAvailable),
    usedEquipmentAllowed: toFormBoolean(product.usedEquipmentAllowed),
    saleLeasebackAvailable: toFormBoolean(product.saleLeasebackAvailable),
    advanceRate: toFormValue(product.advanceRatePercent),
    minAdvanceRate: toFormValue(product.advanceRatePercent),
    maxAdvanceRate: toFormValue(product.maxAdvanceRatePercent),
    transactionFee: toFormValue(product.transactionFeePercent),
    minGrossMargin: toFormValue(product.minGrossMarginPercent),
    internationalPosAllowed: Boolean(product.internationalPosAllowed),
    discountFee: toFormValue(product.discountFeePercent),
    maxInvoiceAgeDays: toFormValue(product.maxInvoiceAgeDays),
    minInvoiceAgeDays: toFormValue(product.minInvoiceAgeDays),
    nonRecourseAvailable: Boolean(product.nonRecourseAvailable),
    governmentInvoicesOk: Boolean(product.governmentInvoicesOk),
    minMonthlyAr: toFormValue(product.minMonthlyArAmount),
    recourseFactoringAllowed: toFormBoolean(product.recourseFactoringAllowed),
    invoiceFactoringAllowed: toFormBoolean(product.invoiceFactoringAllowed),
    arLineOfCreditAllowed: toFormBoolean(product.arLineOfCreditAllowed),
    assetBasedLendingAllowed: toFormBoolean(product.assetBasedLendingAllowed),
    purchaseOrderFinancingAllowed: toFormBoolean(
      product.purchaseOrderFinancingAllowed,
    ),
    domesticArAllowed: toFormBoolean(product.domesticArAllowed),
    internationalArAllowed: toFormBoolean(product.internationalArAllowed),
    b2bReceivablesAllowed: toFormBoolean(product.b2bReceivablesAllowed),
    b2cReceivablesAllowed: toFormBoolean(product.b2cReceivablesAllowed),
    concentrationLimit: toFormValue(product.concentrationLimitPercent),
    minInvoiceSize: toFormValue(product.minInvoiceSizeAmount),
    maxInvoiceSize: toFormValue(product.maxInvoiceSizeAmount),
    maxInvoiceDilution: toFormValue(product.maxInvoiceDilutionPercent),
    minDebtorCreditScore: toFormValue(product.minDebtorCreditScore),
    customerCreditInsuranceRequired: toFormBoolean(
      product.customerCreditInsuranceRequired,
    ),
    existingLiensAccepted: toFormBoolean(product.existingLiensAccepted),
    taxLiensAccepted: toFormBoolean(product.taxLiensAccepted),
    uccFilingRequired: toFormBoolean(product.uccFilingRequired),
    minEligibleAr: toFormValue(product.minEligibleArAmount),
    maxArConcentration: toFormValue(product.maxArConcentrationPercent),
    earlyPaymentDiscount: toFormValue(product.earlyPaymentDiscountPercent),
    paymentTermsExtensionDays: toFormValue(product.paymentTermsExtensionDays),
    dynamicDiscountingAvailable: Boolean(product.dynamicDiscountingAvailable),
    reverseFactoringAvailable: Boolean(product.reverseFactoringAvailable),
    ownerOccupiedRequired: Boolean(product.ownerOccupiedRequired),
    ownerOccupancyRequirement: product.ownerOccupancyRequirement ?? "",
    environmentalReportRequired: toFormBoolean(product.environmentalReportRequired),
    appraisalRequired: toFormBoolean(product.appraisalRequired),
    maxTotalProject: toFormValue(product.maxTotalProjectAmount),
    maxSba504Debenture: toFormValue(product.maxSba504DebentureAmount),
    jobCreationRequired: Boolean(product.jobCreationRequired),
    maxUsdaGuarantee: toFormValue(product.maxUsdaGuaranteeAmount),
    usdaGuaranteePercent: toFormValue(product.usdaGuaranteePercent),
    ruralAreaRequired: Boolean(product.ruralAreaRequired),
    preferredReturn: toFormValue(product.preferredReturnPercent),
    mezzLtvMin: toFormValue(product.minMezzLtvPercent),
    mezzLtvMax: toFormValue(product.maxMezzLtvPercent),
    exitFee: toFormValue(product.exitFeePercent),
    minLtv: toFormValue(product.minMezzLtvPercent),
    maxLtv: toFormValue(
      product.maxLtvPercent ?? product.maxMezzLtvPercent,
    ),
    maxArv: toFormValue(product.maxArvPercent),
    maxLtc: toFormValue(product.maxLtcPercent),
    fico: toFormValue(product.minCreditScore),
    minDscr: toFormValue(product.minDscr),
    minDebtYield: toFormValue(product.minDebtYieldPercent),
    amortizationYears: toFormValue(product.amortizationYears),
    amortizationMonths: toFormValue(
      product.amortizationMonths ??
        (product.amortizationYears != null && product.amortizationYears !== ""
          ? Number(product.amortizationYears) * 12
          : ""),
    ),
    minUnits: toFormValue(product.minUnits),
    maxUnits: toFormValue(product.maxUnits),
    prepaymentStructure: product.prepaymentStructure ?? "",
    minProperties: toFormValue(product.minPropertiesInPortfolio),
    maxProperties: toFormValue(product.maxPropertiesInPortfolio),
    experience: toFormValue(product.minExperience),
    originationPoints: toFormValue(product.originationPointsPercent),
    extensionAvailable: toFormBoolean(product.extensionAvailable),
    personalGuaranteeRequired: toFormBoolean(product.personalGuaranteeRequired),
    firstTimeBorrowersAllowed: toFormBoolean(product.firstTimeBorrowersAllowed),
    interestOnlyAvailable: toFormBoolean(product.interestOnlyAvailable),
    shortTermRentalsOk: toFormBoolean(product.shortTermRentalsOk),
    foreignNationalsAllowed: toFormBoolean(product.foreignNationalsAllowed),
    minPropertyValue: toFormValue(product.minPropertyValueAmount),
    maxPropertyValue: toFormValue(product.maxPropertyValueAmount),
    unit1Allowed: toFormBoolean(product.unit1Allowed),
    unit2Allowed: toFormBoolean(product.unit2Allowed),
    unit3Allowed: toFormBoolean(product.unit3Allowed),
    unit4Allowed: toFormBoolean(product.unit4Allowed),
    ownerOccupiedAllowed: toFormBoolean(product.ownerOccupiedAllowed),
    nonOwnerOccupiedAllowed: toFormBoolean(product.nonOwnerOccupiedAllowed),
    purchaseAllowed: toFormBoolean(product.purchaseAllowed),
    cashOutRefinanceAllowed: toFormBoolean(product.cashOutRefinanceAllowed),
    renovationAllowed: toFormBoolean(product.renovationAllowed),
    heavyRehabAllowed: toFormBoolean(product.heavyRehabAllowed),
    lightRehabAllowed: toFormBoolean(product.lightRehabAllowed),
    vacantPropertyAllowed: toFormBoolean(product.vacantPropertyAllowed),
    tenantOccupiedAllowed: toFormBoolean(product.tenantOccupiedAllowed),
    foreclosureReoAllowed: toFormBoolean(product.foreclosureReoAllowed),
    llcEntityBorrowerAllowed: toFormBoolean(product.llcEntityBorrowerAllowed),
    propertyTypesExcluded: product.propertyTypesExcluded ?? "",
    maxLtvCashOut: toFormValue(product.maxLtvCashOutPercent),
    minRentalIncome: toFormValue(product.minRentalIncomeAmount),
    rentalIncomeRequired: toFormBoolean(product.rentalIncomeRequired),
    longTermRentalAllowed: toFormBoolean(product.longTermRentalAllowed),
    leaseRequired: toFormBoolean(product.leaseRequired),
    marketRentScheduleAccepted: toFormBoolean(
      product.marketRentScheduleAccepted,
    ),
    firstTimeInvestorAllowed: toFormBoolean(product.firstTimeInvestorAllowed),
    foreclosureShortSaleAllowed: toFormBoolean(
      product.foreclosureShortSaleAllowed,
    ),
    minInvestorExperienceDeals: toFormValue(
      product.minInvestorExperienceDeals,
    ),
    moderateRehabAllowed: toFormBoolean(product.moderateRehabAllowed),
    groundUpConstructionAllowed: toFormBoolean(
      product.groundUpConstructionAllowed,
    ),
    shortSaleAllowed: toFormBoolean(product.shortSaleAllowed),
    borrowerExperienceRequired: toFormBoolean(
      product.borrowerExperienceRequired,
    ),
    rehabFundsFinanced: toFormBoolean(product.rehabFundsFinanced),
    rehabFundsMaxPercent: toFormValue(product.rehabFundsMaxPercent),
    drawScheduleRequired: toFormBoolean(product.drawScheduleRequired),
    gcRequired: toFormBoolean(product.gcRequired),
    completionGuaranteeRequired: toFormBoolean(
      product.completionGuaranteeRequired,
    ),
    minConstructionProjectsCompleted: toFormValue(
      product.minConstructionProjectsCompleted,
    ),
    tearDownRebuildAllowed: toFormBoolean(product.tearDownRebuildAllowed),
    majorRenovationAllowed: toFormBoolean(product.majorRenovationAllowed),
    constructionToPermanentAllowed: toFormBoolean(
      product.constructionToPermanentAllowed,
    ),
    lotPurchaseIncluded: toFormBoolean(product.lotPurchaseIncluded),
    landAlreadyOwnedAllowed: toFormBoolean(product.landAlreadyOwnedAllowed),
    landEquityAllowed: toFormBoolean(product.landEquityAllowed),
    softCostsFinanced: toFormBoolean(product.softCostsFinanced),
    hardCostsFinanced: toFormBoolean(product.hardCostsFinanced),
    contingencyFinanced: toFormBoolean(product.contingencyFinanced),
    interestReserveFinanced: toFormBoolean(product.interestReserveFinanced),
    ownerBuilderAllowed: toFormBoolean(product.ownerBuilderAllowed),
    firstTimeBuilderAllowed: toFormBoolean(product.firstTimeBuilderAllowed),
    inspectionRequiredForDraws: toFormBoolean(
      product.inspectionRequiredForDraws,
    ),
    minOwnershipExperienceYears: toFormValue(
      product.minOwnershipExperienceYears,
    ),
    rateTermRefinanceAllowed: toFormBoolean(product.rateTermRefinanceAllowed),
    multifamily5PlusAllowed: toFormBoolean(product.multifamily5PlusAllowed),
    apartmentAllowed: toFormBoolean(product.apartmentAllowed),
    officeAllowed: toFormBoolean(product.officeAllowed),
    retailAllowed: toFormBoolean(product.retailAllowed),
    industrialAllowed: toFormBoolean(product.industrialAllowed),
    mixedUseAllowed: toFormBoolean(product.mixedUseAllowed),
    selfStorageAllowed: toFormBoolean(product.selfStorageAllowed),
    hotelHospitalityAllowed: toFormBoolean(product.hotelHospitalityAllowed),
    medicalHealthcareAllowed: toFormBoolean(product.medicalHealthcareAllowed),
    studentHousingAllowed: toFormBoolean(product.studentHousingAllowed),
    mobileHomeParkAllowed: toFormBoolean(product.mobileHomeParkAllowed),
    seniorHousingAllowed: toFormBoolean(product.seniorHousingAllowed),
    minOccupancy: toFormValue(product.minOccupancyPercent),
    minAnnualNoi: toFormValue(product.minAnnualNoiAmount),
    stabilizedPropertyRequired: toFormBoolean(
      product.stabilizedPropertyRequired,
    ),
    leaseUpPropertiesAccepted: toFormBoolean(product.leaseUpPropertiesAccepted),
    valueAddPropertiesAccepted: toFormBoolean(
      product.valueAddPropertiesAccepted,
    ),
    newlyRenovatedPropertiesAllowed: toFormBoolean(
      product.newlyRenovatedPropertiesAllowed,
    ),
    propertyConditionAssessmentRequired: toFormBoolean(
      product.propertyConditionAssessmentRequired,
    ),
    agencyProgram: product.agencyProgram ?? "",
    supplementalFinancingAllowed: toFormBoolean(
      product.supplementalFinancingAllowed,
    ),
    marketRateMultifamilyAllowed: toFormBoolean(
      product.marketRateMultifamilyAllowed,
    ),
    affordableHousingAllowed: toFormBoolean(product.affordableHousingAllowed),
    cooperativeHousingAllowed: toFormBoolean(product.cooperativeHousingAllowed),
    manufacturedHousingCommunityAllowed: toFormBoolean(
      product.manufacturedHousingCommunityAllowed,
    ),
    smallBalanceMultifamilyAllowed: toFormBoolean(
      product.smallBalanceMultifamilyAllowed,
    ),
    minDscrFixedRate: toFormValue(product.minDscrFixedRate),
    minDscrArm: toFormValue(product.minDscrArm),
    newConstructionAllowed: toFormBoolean(product.newConstructionAllowed),
    renovationModerateRehabAllowed: toFormBoolean(
      product.renovationModerateRehabAllowed,
    ),
    mezzPreferredFinancingType: product.mezzPreferredFinancingType ?? "",
    acquisitionFinancingAllowed: toFormBoolean(
      product.acquisitionFinancingAllowed,
    ),
    constructionFinancingAllowed: toFormBoolean(
      product.constructionFinancingAllowed,
    ),
    bridgeFinancingAllowed: toFormBoolean(product.bridgeFinancingAllowed),
    valueAddFinancingAllowed: toFormBoolean(product.valueAddFinancingAllowed),
    recapitalizationAllowed: toFormBoolean(product.recapitalizationAllowed),
    equityGapFinancingAllowed: toFormBoolean(product.equityGapFinancingAllowed),
    maxStabilizedLtv: toFormValue(product.maxStabilizedLtvPercent),
    debtRefinanceAllowed: toFormBoolean(product.debtRefinanceAllowed),
    minLoanSizeForPropertyType: toFormValue(
      product.minLoanSizeForPropertyTypeAmount,
    ),
    badBoyGuaranteeRequired: toFormBoolean(product.badBoyGuaranteeRequired),
    springingRecourseAllowed: toFormBoolean(product.springingRecourseAllowed),
    defeasanceAllowed: toFormBoolean(product.defeasanceAllowed),
    yieldMaintenanceAllowed: toFormBoolean(product.yieldMaintenanceAllowed),
    interestOnlyPeriodMonths: toFormValue(product.interestOnlyPeriodMonths),
    portfolioRefinanceAllowed: toFormBoolean(product.portfolioRefinanceAllowed),
    crossCollateralizationAllowed: toFormBoolean(
      product.crossCollateralizationAllowed,
    ),
    residential1To4Allowed: toFormBoolean(product.residential1To4Allowed),
    minPortfolioValue: toFormValue(product.minPortfolioValueAmount),
    maxPortfolioValue: toFormValue(product.maxPortfolioValueAmount),
    minPortfolioNoi: toFormValue(product.minPortfolioNoiAmount),
    minPortfolioRentalIncome: toFormValue(
      product.minPortfolioRentalIncomeAmount,
    ),
    minCashReserves: toFormValue(product.minCashReservesAmount),
    minMonthsReserves: toFormValue(product.minMonthsReserves),
    minEbitda: toFormValue(product.minEbitdaAmount),
    newEquipmentAllowed: toFormBoolean(product.newEquipmentAllowed),
    equipmentRefinanceAllowed: toFormBoolean(product.equipmentRefinanceAllowed),
    equipmentLeaseAllowed: toFormBoolean(product.equipmentLeaseAllowed),
    leaseToOwnAllowed: toFormBoolean(product.leaseToOwnAllowed),
    installationCostsFinanced: toFormBoolean(product.installationCostsFinanced),
    transportationFreightCostsFinanced: toFormBoolean(
      product.transportationFreightCostsFinanced,
    ),
    firstTimeBusinessOwnersAllowed: toFormBoolean(
      product.firstTimeBusinessOwnersAllowed,
    ),
    existingBusinessAllowed: toFormBoolean(product.existingBusinessAllowed),
    leaseholdImprovementsAllowed: toFormBoolean(
      product.leaseholdImprovementsAllowed,
    ),
    minEquipmentValue: toFormValue(product.minEquipmentValueAmount),
    maxEquipmentValue: toFormValue(product.maxEquipmentValueAmount),
    maxEquipmentAgeYears: toFormValue(product.maxEquipmentAgeYears),
    minUsefulLifeRemainingYears: toFormValue(
      product.minUsefulLifeRemainingYears,
    ),
    equipmentAppraisalRequired: toFormBoolean(
      product.equipmentAppraisalRequired,
    ),
    vendorInvoiceRequired: toFormBoolean(product.vendorInvoiceRequired),
    equipmentTypesExcluded: product.equipmentTypesExcluded ?? "",
    industriesExcluded: product.industriesExcluded ?? "",
    minMonthlyPayables: toFormValue(product.minMonthlyPayablesAmount),
    vendorSupplierFinancingAllowed: toFormBoolean(
      product.vendorSupplierFinancingAllowed,
    ),
    tradePayablesFinancingAllowed: toFormBoolean(
      product.tradePayablesFinancingAllowed,
    ),
    inventoryFinancingAllowed: toFormBoolean(product.inventoryFinancingAllowed),
    seasonalWorkingCapitalAllowed: toFormBoolean(
      product.seasonalWorkingCapitalAllowed,
    ),
    accountsReceivableFinancingAllowed: toFormBoolean(
      product.accountsReceivableFinancingAllowed,
    ),
    investmentPropertyAllowed: toFormBoolean(product.investmentPropertyAllowed),
    commercialRealEstateAllowed: toFormBoolean(
      product.commercialRealEstateAllowed,
    ),
    supplyChainFinanceAllowed: toFormBoolean(product.supplyChainFinanceAllowed),
    domesticVendorsAllowed: toFormBoolean(product.domesticVendorsAllowed),
    internationalVendorsAllowed: toFormBoolean(
      product.internationalVendorsAllowed,
    ),
    governmentContractorsAllowed: toFormBoolean(
      product.governmentContractorsAllowed,
    ),
    maxVendorConcentration: toFormValue(product.maxVendorConcentrationPercent),
    minVendorCreditQuality: product.minVendorCreditQuality ?? "",
    vendorVerificationRequired: toFormBoolean(
      product.vendorVerificationRequired,
    ),
    purchaseOrderRequired: toFormBoolean(product.purchaseOrderRequired),
    minEligiblePayables: toFormValue(product.minEligiblePayablesAmount),
    maxPayablesConcentration: toFormValue(
      product.maxPayablesConcentrationPercent,
    ),
    domesticPosAllowed: toFormBoolean(product.domesticPosAllowed),
    governmentPosAllowed: toFormBoolean(product.governmentPosAllowed),
    recurringPosAllowed: toFormBoolean(product.recurringPosAllowed),
    oneTimePosAllowed: toFormBoolean(product.oneTimePosAllowed),
    manufacturingRequired: toFormBoolean(product.manufacturingRequired),
    finishedGoodsAllowed: toFormBoolean(product.finishedGoodsAllowed),
    rawMaterialsAllowed: toFormBoolean(product.rawMaterialsAllowed),
    supplierVendorPaymentAllowed: toFormBoolean(
      product.supplierVendorPaymentAllowed,
    ),
    purchaseOrderAssignmentAllowed: toFormBoolean(
      product.purchaseOrderAssignmentAllowed,
    ),
    minPoAmount: toFormValue(product.minPoAmountAmount),
    maxPoAmount: toFormValue(product.maxPoAmountAmount),
    minCustomerCreditScore: toFormValue(product.minCustomerCreditScore),
    minCustomerCreditRating: product.minCustomerCreditRating ?? "",
    maxCustomerConcentration: toFormValue(
      product.maxCustomerConcentrationPercent,
    ),
    minGrossProfitMargin: toFormValue(product.minGrossProfitMarginPercent),
    minCustomerDeposit: toFormValue(product.minCustomerDepositPercent),
    customerVerificationRequired: toFormBoolean(
      product.customerVerificationRequired,
    ),
    minEligiblePoValue: toFormValue(product.minEligiblePoValueAmount),
    maxPoConcentration: toFormValue(product.maxPoConcentrationPercent),
    criteriaNotes: product.criteriaNotes ?? "",
    states: Array.isArray(product.statesSupported)
      ? product.statesSupported
      : product.statesSupported
        ? String(product.statesSupported).split(",").filter(Boolean)
        : [],
    documents: normalizeDocumentsForForm(product),
    minRate: interestRates.minRate,
    maxRate: interestRates.maxRate,
  };
};
