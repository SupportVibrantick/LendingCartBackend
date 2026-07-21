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
  ...FIX_AND_FLIP_CODES,
  ...BRIDGE_LOAN_CODES,
]);
export type CriteriaFieldType = "number" | "toggle" | "textarea" | "text";

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

export const SBA_504_LOAN_CODES = new Set([
  "SBA_504",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "SBA_504_REAL_ESTATE_EQUIPMENT",
]);

export const USDA_BI_LOAN_CODES = new Set(["USDA_BI"]);

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
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Min LTV (%)",
    key: "minLtv",
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
    label: "Origination Points (%)",
    key: "originationPoints",
    required: true,
    decimal: true,
    inputSuffix: "%",
  },
  {
    label: "Industry Experience (Years)",
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
  "minRate",
  "maxRate",
  "minRateSpread",
  "maxRateSpread",
  "originationPoints",
  "requiredInjection",
  "sbaGuaranteePercent",
  "maxFinancingPercent",
  "mezzLtvMin",
  "mezzLtvMax",
  "minDebtYield",
  "exitFee",
  "preferredReturn",
  "usdaGuaranteePercent",
  "advanceRate",
  "transactionFee",
  "minGrossMargin",
  "discountFee",
  "earlyPaymentDiscount",
]);

export const getProductRateCriteriaFields = (
  productCode: string,
): CriteriaField[] => {
  if (isSba7aRateSpreadProduct(productCode)) {
    return [
      {
        label: "Min Rate Spread (%)",
        key: "minRateSpread",
        required: true,
        decimal: true,
        inputSuffix: "%",
      },
      {
        label: "Max Rate Spread (%)",
        key: "maxRateSpread",
        required: true,
        decimal: true,
        inputSuffix: "%",
      },
    ];
  }

  if (isSba504Product(productCode)) {
    return [
      {
        label: "Interest Structure",
        key: "interestRateNote",
        type: "textarea",
        required: false,
      },
    ];
  }

  return [
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
  ];
};

export const getCriteriaFieldInputSuffix = (
  field: CriteriaField,
): string | null => {
  if (field.inputSuffix) {
    return field.inputSuffix;
  }

  if (field.key === "minDscr") {
    return "x";
  }

  if (
    PERCENTAGE_FIELD_KEYS.has(field.key) ||
    field.label.includes("(%)") ||
    field.label.includes("(%)")
  ) {
    return "%";
  }

  if (field.label.includes("(Years)")) {
    return "yr";
  }

  if (field.label.includes("(months)")) {
    return "mo";
  }

  if (field.label.includes("(days)")) {
    return "days";
  }

  return null;
};

const mergeWithUniversalCriteriaFields = (
  productCode: string,
  productFields: CriteriaField[],
): CriteriaField[] => {
  const excludedKeys = new Set([
    ...UNIVERSAL_CRITERIA_KEYS,
    ...RATE_CRITERIA_KEYS,
  ]);

  const additionalFields = productFields.filter(
    (field) => !excludedKeys.has(field.key),
  );

  const rateFields = getProductRateCriteriaFields(productCode);

  return [
    UNIVERSAL_LOAN_CRITERIA_FIELDS[0],
    UNIVERSAL_LOAN_CRITERIA_FIELDS[1],
    UNIVERSAL_LOAN_CRITERIA_FIELDS[2],
    ...rateFields,
    ...UNIVERSAL_LOAN_CRITERIA_FIELDS.slice(3),
    ...additionalFields,
  ];
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
      ...SBA_504_LOAN_CODES,
      ...USDA_BI_LOAN_CODES,
      ...PURCHASE_ORDER_FINANCE_LOAN_CODES,
      ...EQUIPMENT_FINANCE_LOAN_CODES,
      ...INVOICE_FACTORING_LOAN_CODES,
      ...ACCOUNTS_PAYABLE_FINANCE_LOAN_CODES,
    ],
  },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
];

const BRIDGE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Max LTC (%)", key: "maxLtc", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  {
    label: "Extension Available",
    key: "extensionAvailable",
    type: "toggle",
    required: false,
  },
  {
    label: "Personal Guarantee Required",
    key: "personalGuaranteeRequired",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const FIX_AND_FLIP_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV — Purchase (%)", key: "maxLtv", required: true },
  { label: "Max ARV LTV (%)", key: "maxArv", required: true },
  { label: "Max LTC (%)", key: "maxLtc", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  {
    label: "First-Time Borrowers Allowed",
    key: "firstTimeBorrowersAllowed",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const DSCR_RENTAL_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min FICO Score", key: "fico", required: true },
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
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  {
    label: "Interest Only Available",
    key: "interestOnlyAvailable",
    type: "toggle",
    required: false,
  },
  {
    label: "Short-Term Rentals OK",
    key: "shortTermRentalsOk",
    type: "toggle",
    required: false,
  },
  {
    label: "Foreign Nationals Allowed",
    key: "foreignNationalsAllowed",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const RENTAL_PORTFOLIO_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Portfolio Loan ($)", key: "minLoan", required: true },
  { label: "Max Portfolio Loan ($)", key: "maxLoan", required: true },
  {
    label: "Min Properties in Portfolio",
    key: "minProperties",
    required: true,
  },
  {
    label: "Max Properties in Portfolio",
    key: "maxProperties",
    required: true,
  },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min FICO Score", key: "fico", required: true },
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
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const CONSTRUCTION_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTC (%)", key: "maxLtc", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  {
    label: "GC Required",
    key: "gcRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Completion Guarantee Required",
    key: "completionGuaranteeRequired",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const CRE_PERMANENT_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min Debt Yield (%)", key: "minDebtYield", required: false },
  { label: "Min FICO Score", key: "fico", required: true },
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
  {
    label: "Amortization (years)",
    key: "amortizationYears",
    required: true,
  },
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const CMBS_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min Debt Yield (%)", key: "minDebtYield", required: false },
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
  {
    label: "Amortization (years)",
    key: "amortizationYears",
    required: true,
  },
  {
    label: "Prepayment Structure",
    key: "prepaymentStructure",
    type: "text",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const AGENCY_MULTIFAMILY_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
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
  {
    label: "Amortization (years)",
    key: "amortizationYears",
    required: true,
  },
  { label: "Min Units", key: "minUnits", required: true },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const MEZZANINE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Mezz LTV Min (%)", key: "mezzLtvMin", required: true },
  { label: "Mezz LTV Max (%)", key: "mezzLtvMax", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Origination Points (%)", key: "originationPoints", required: true },
  { label: "Exit Fee (%)", key: "exitFee", required: true },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const PREFERRED_EQUITY_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Investment ($)", key: "minLoan", required: true },
  { label: "Max Investment ($)", key: "maxLoan", required: true },
  { label: "Preferred Return (%)", key: "preferredReturn", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Origination Fee (%)", key: "originationPoints", required: true },
  { label: "Exit Fee (%)", key: "exitFee", required: true },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

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
  { label: "Min Rate Spread (%)", key: "minRateSpread", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
  { label: "SBA Guarantee (%)", key: "sbaGuaranteePercent", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
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
  ...SBA_7A_COMMON_FIELDS.slice(0, 2),
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  ...SBA_7A_COMMON_FIELDS.slice(2, 6),
  {
    label: "Buyer Equity Injection (%)",
    key: "requiredInjection",
    required: true,
  },
  ...SBA_7A_COMMON_FIELDS.slice(6, 8),
  {
    label: "Min Liquidity Requirement",
    key: "minLiquidityRequirement",
    type: "textarea",
    required: false,
  },
  {
    label: "Management Experience (Years)",
    key: "experience",
    required: true,
  },
  {
    label: "Goodwill Financing Allowed",
    key: "goodwillFinancingAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Seller Note Allowed",
    key: "sellerFinancingAllowed",
    type: "toggle",
    required: false,
  },
  ...SBA_7A_COMMON_FIELDS.slice(8),
];

const SBA_7A_WORKING_CAPITAL_CRITERIA_FIELDS: CriteriaField[] = [
  ...SBA_7A_COMMON_FIELDS.slice(0, 2),
  {
    label: "Max Financing (%)",
    key: "maxFinancingPercent",
    required: true,
  },
  ...SBA_7A_COMMON_FIELDS.slice(2, 8),
  {
    label: "Min Time In Business (months)",
    key: "minTimeInBusiness",
    required: true,
  },
  { label: "Min Annual Revenue ($)", key: "minAnnualRevenue", required: true },
  {
    label: "Use of Funds",
    key: "useOfFunds",
    type: "textarea",
    required: false,
  },
  {
    label: "Collateral Requirements",
    key: "collateralRequirements",
    type: "textarea",
    required: false,
  },
  {
    label: "Startup Allowed",
    key: "startupAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Line of Credit Available",
    key: "lineOfCreditAvailable",
    type: "toggle",
    required: false,
  },
  {
    label: "Prepayment Penalty",
    key: "prepaymentStructure",
    type: "text",
    required: false,
  },
  ...SBA_7A_COMMON_FIELDS.slice(8),
];

const SBA_7A_EQUIPMENT_PURCHASE_CRITERIA_FIELDS: CriteriaField[] = [
  ...SBA_7A_COMMON_FIELDS.slice(0, 2),
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Max LTC (%)", key: "maxLtc", required: true },
  ...SBA_7A_COMMON_FIELDS.slice(2, 8),
  {
    label: "Min Time In Business (months)",
    key: "minTimeInBusiness",
    required: true,
  },
  {
    label: "Startup Allowed",
    key: "startupAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "New & Used Equipment Allowed",
    key: "usedEquipmentAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Prepayment Penalty",
    key: "prepaymentStructure",
    type: "text",
    required: false,
  },
  ...SBA_7A_COMMON_FIELDS.slice(8),
];

const SBA_7A_REAL_ESTATE_CRITERIA_FIELDS: CriteriaField[] = [
  ...SBA_7A_COMMON_FIELDS.slice(0, 2),
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  ...SBA_7A_COMMON_FIELDS.slice(2, 8),
  {
    label: "Owner Occupancy Requirement",
    key: "ownerOccupancyRequirement",
    type: "textarea",
    required: false,
  },
  {
    label: "Owner-Occupied Required",
    key: "ownerOccupiedRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Environmental Review Required",
    key: "environmentalReportRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Appraisal Required",
    key: "appraisalRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Balloon Payment",
    key: "prepaymentStructure",
    type: "text",
    required: false,
  },
  ...SBA_7A_COMMON_FIELDS.slice(8),
];

const SBA_504_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Total Project ($)", key: "maxTotalProject", required: true },
  {
    label: "Max SBA 504 Debenture ($)",
    key: "maxSba504Debenture",
    required: true,
  },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Max LTC (%)", key: "maxLtc", required: true },
  {
    label: "Borrower Equity Injection (%)",
    key: "requiredInjection",
    required: true,
  },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Min Time In Business (months)",
    key: "minTimeInBusiness",
    required: true,
  },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  {
    label: "Interest Rate",
    key: "interestRateNote",
    type: "text",
    required: false,
  },
  {
    label: "Rate Structure",
    key: "rateStructure",
    type: "text",
    required: false,
  },
  {
    label: "Owner Occupancy Requirement",
    key: "ownerOccupancyRequirement",
    type: "textarea",
    required: false,
  },
  {
    label: "Owner-Occupied Required",
    key: "ownerOccupiedRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Eligible Use of Funds",
    key: "useOfFunds",
    type: "textarea",
    required: false,
  },
  {
    label: "Collateral Requirements",
    key: "collateralRequirements",
    type: "textarea",
    required: false,
  },
  {
    label: "Environmental Review Required",
    key: "environmentalReportRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Appraisal Required",
    key: "appraisalRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Personal Guarantee Required",
    key: "personalGuaranteeRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Job Creation Required",
    key: "jobCreationRequired",
    type: "toggle",
    required: false,
  },
  {
    label: "Startup Allowed",
    key: "startupAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Refinance Allowed",
    key: "refinanceAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Working Capital Eligible",
    key: "workingCapitalEligible",
    type: "toggle",
    required: false,
  },
  {
    label: "Life Insurance May Be Required",
    key: "lifeInsuranceMayBeRequired",
    type: "toggle",
    required: false,
  },
  ...SBA_TERM_FIELDS,
  {
    label: "Prepayment Penalty",
    key: "prepaymentStructure",
    type: "text",
    required: false,
  },
  {
    label: "Estimated Closing Time (days)",
    key: "avgTurnaroundDays",
    required: true,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const USDA_BI_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  {
    label: "Max USDA Guarantee ($)",
    key: "maxUsdaGuarantee",
    required: true,
  },
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
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "USDA Guarantee (%)", key: "usdaGuaranteePercent", required: true },
  {
    label: "Rural Area Required",
    key: "ruralAreaRequired",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const PURCHASE_ORDER_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Facility Size ($)", key: "minFacilitySize", required: true },
  { label: "Max Facility Size ($)", key: "maxFacilitySize", required: true },
  { label: "Advance Rate (%)", key: "advanceRate", required: true },
  { label: "Transaction Fee (%)", key: "transactionFee", required: true },
  { label: "Min Gross Margin (%)", key: "minGrossMargin", required: true },
  {
    label: "International POs Allowed",
    key: "internationalPosAllowed",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const INVOICE_FACTORING_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Facility Size ($)", key: "minFacilitySize", required: true },
  { label: "Max Facility Size ($)", key: "maxFacilitySize", required: true },
  { label: "Advance Rate (%)", key: "advanceRate", required: true },
  { label: "Discount Fee (%)", key: "discountFee", required: true },
  { label: "Max Invoice Age (days)", key: "maxInvoiceAgeDays", required: true },
  {
    label: "Non-Recourse Available",
    key: "nonRecourseAvailable",
    type: "toggle",
    required: false,
  },
  {
    label: "Government Invoices OK",
    key: "governmentInvoicesOk",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const ACCOUNTS_PAYABLE_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Program Size ($)", key: "minProgramSize", required: true },
  { label: "Max Program Size ($)", key: "maxProgramSize", required: true },
  {
    label: "Early Payment Discount (%)",
    key: "earlyPaymentDiscount",
    required: true,
  },
  {
    label: "Payment Terms Extension (days)",
    key: "paymentTermsExtensionDays",
    required: true,
  },
  {
    label: "Dynamic Discounting Available",
    key: "dynamicDiscountingAvailable",
    type: "toggle",
    required: false,
  },
  {
    label: "Reverse Factoring Available",
    key: "reverseFactoringAvailable",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
];

const EQUIPMENT_FINANCE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Finance Amount ($)", key: "minLoan", required: true },
  { label: "Max Finance Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  {
    label: "Used Equipment Allowed",
    key: "usedEquipmentAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Sale-Leaseback Available",
    key: "saleLeasebackAvailable",
    type: "toggle",
    required: false,
  },
  { label: "Additional Guidelines", key: "criteriaNotes", type: "textarea", required: false },
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

export const isSba504Product = (productCode?: string | null) =>
  productCode ? SBA_504_LOAN_CODES.has(productCode) : false;

export const isUsdaBiProduct = (productCode?: string | null) =>
  productCode ? USDA_BI_LOAN_CODES.has(productCode) : false;

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
  isSba7aRealEstateProduct(productCode);

export const isAnySba7aProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode);

export const isAnySbaProduct = (productCode?: string | null) =>
  isAnySba7aProduct(productCode) || isSba504Product(productCode);

export const isNoMinLoanCriteriaProduct = (productCode?: string | null) =>
  isUsdaBiProduct(productCode);

export const isSba7aNoLtvProduct = (productCode?: string | null) =>
  isSba7aGeneralProduct(productCode) || isSba7aWorkingCapitalProduct(productCode);

export const supportsSbaLtcProduct = (productCode?: string | null) =>
  isSba7aEquipmentPurchaseProduct(productCode) || isSba504Product(productCode);

export const isNoLtvCriteriaProduct = (productCode?: string | null) =>
  isSba7aNoLtvProduct(productCode) || isUsdaBiProduct(productCode);

export const isNoPropertyMetricsProduct = (productCode?: string | null) =>
  isNoLtvCriteriaProduct(productCode) ||
  isPurchaseOrderFinanceProduct(productCode) ||
  isEquipmentFinanceProduct(productCode) ||
  isArFactoringProduct(productCode) ||
  isApSupplyChainProduct(productCode);

export const isNoTermCriteriaProduct = (productCode?: string | null) =>
  isPurchaseOrderFinanceProduct(productCode) ||
  isArFactoringProduct(productCode) ||
  isApSupplyChainProduct(productCode);

export const isSba7aRateSpreadProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode);

const usesYearTerms = (productCode: string) =>
  isDscrRentalProduct(productCode) ||
  isRentalPortfolioProduct(productCode) ||
  isCrePermanentProduct(productCode) ||
  isCmbsProduct(productCode) ||
  isAgencyMultifamilyProduct(productCode) ||
  isSba7aBusinessAcquisitionProduct(productCode) ||
  isSba7aWorkingCapitalProduct(productCode) ||
  isSba7aEquipmentPurchaseProduct(productCode) ||
  isSba7aRealEstateProduct(productCode) ||
  isSba504Product(productCode) ||
  isUsdaBiProduct(productCode);

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
): CriteriaField[] =>
  mergeWithUniversalCriteriaFields(
    productCode,
    getProductSpecificCriteriaFields(productCode),
  );

export const getRequiredCriteriaKeysForProduct = (
  productCode: string,
): string[] =>
  getCriteriaFieldsForProduct(productCode)
    .filter((field) => field.required !== false && field.type !== "toggle")
    .map((field) => field.key);

export const getDefaultCriteriaValuesForProduct = (
  productCode: string,
): Record<string, any> => {
  if (isSba7aBusinessAcquisitionProduct(productCode)) {
    return {
      minLoan: "250000",
      maxLoan: "5000000",
      maxLtv: "90",
      requiredInjection: "10",
      minRateSpread: "2.25",
      maxRateSpread: "2.75",
      sbaGuaranteePercent: "75",
      fico: "680",
      minDscr: "1.25",
      maxTerm: "10",
      personalGuaranteeRequired: true,
      goodwillFinancingAllowed: true,
      sellerFinancingAllowed: true,
      minLiquidityRequirement: "Varies by lender",
      criteriaNotes:
        "Amortization up to 10 years (25 years if real estate included).",
    };
  }

  if (isSba7aWorkingCapitalProduct(productCode)) {
    return {
      minLoan: "50000",
      maxLoan: "5000000",
      maxFinancingPercent: "100",
      minRateSpread: "2.25",
      maxRateSpread: "3.00",
      sbaGuaranteePercent: "75",
      fico: "650",
      minDscr: "1.20",
      minTimeInBusiness: "24",
      minAnnualRevenue: "150000",
      maxTerm: "10",
      personalGuaranteeRequired: true,
      lineOfCreditAvailable: true,
      startupAllowed: false,
      prepaymentStructure: "Generally None",
      useOfFunds:
        "Payroll, Inventory, Marketing, Expansion, Operating Expenses, Debt Refinance (eligible)",
      collateralRequirements:
        "Available Collateral Preferred; May Be Undersecured",
      criteriaNotes:
        "Minimum FICO typically 650–680. Amortization up to 10 years.",
    };
  }

  if (isSba7aEquipmentPurchaseProduct(productCode)) {
    return {
      minLoan: "100000",
      maxLoan: "5000000",
      maxLtv: "90",
      maxLtc: "100",
      minRateSpread: "2.00",
      maxRateSpread: "3.00",
      sbaGuaranteePercent: "75",
      fico: "680",
      minDscr: "1.20",
      minTimeInBusiness: "24",
      maxTerm: "10",
      personalGuaranteeRequired: true,
      startupAllowed: true,
      usedEquipmentAllowed: true,
      prepaymentStructure: "None (Generally)",
      criteriaNotes:
        "Amortization up to 10 years or useful life of equipment. Personal guarantee required from 20%+ owners.",
    };
  }

  if (isSba7aRealEstateProduct(productCode)) {
    return {
      minLoan: "250000",
      maxLoan: "5000000",
      maxLtv: "90",
      minRateSpread: "2.00",
      maxRateSpread: "2.75",
      sbaGuaranteePercent: "75",
      fico: "680",
      minDscr: "1.25",
      maxTerm: "25",
      personalGuaranteeRequired: true,
      ownerOccupiedRequired: true,
      environmentalReportRequired: true,
      appraisalRequired: true,
      ownerOccupancyRequirement:
        "Minimum 51% Existing Building / 60% New Construction",
      prepaymentStructure: "None",
      criteriaNotes:
        "Property types: Office, Retail, Industrial, Warehouse, Medical, Mixed-Use, Hospitality (subject to lender). Amortization up to 25 years.",
    };
  }

  if (isSba504Product(productCode)) {
    return {
      minLoan: "250000",
      maxTotalProject: "20000000",
      maxSba504Debenture: "5500000",
      maxLtv: "90",
      maxLtc: "90",
      requiredInjection: "10",
      fico: "680",
      minTimeInBusiness: "24",
      minDscr: "1.20",
      minTerm: "20",
      maxTerm: "30",
      avgTurnaroundDays: "90",
      personalGuaranteeRequired: true,
      ownerOccupiedRequired: true,
      environmentalReportRequired: true,
      appraisalRequired: true,
      jobCreationRequired: true,
      startupAllowed: true,
      refinanceAllowed: true,
      workingCapitalEligible: false,
      lifeInsuranceMayBeRequired: true,
      interestRateNote: "Fixed Rate (CDC/SBA Portion) + Market Rate on Bank Portion",
      rateStructure: "Bank First Mortgage + SBA 504 Second Mortgage",
      ownerOccupancyRequirement:
        "Minimum 51% for Existing Buildings; 60% for New Construction (Occupancy must increase to 80% over time)",
      useOfFunds:
        "Purchase, Construction, Expansion, Renovation, Land Acquisition, Building Improvements, Long-Life Equipment",
      collateralRequirements: "Subject Property (First & Second Mortgage)",
      prepaymentStructure:
        "Applies to SBA Debenture Portion (Declining Schedule)",
      criteriaNotes:
        "Property types: Office, Retail, Industrial, Warehouse, Manufacturing, Medical, Mixed-Use (Owner-Occupied), Automotive, Self-Storage (lender dependent). Equity injection typically 10% (15% special-purpose, 20% startups). Closing time typically 45–90 days. Investment/passive real estate generally not eligible.",
    };
  }

  return {};
};

export const buildLenderProductCriteriaPayload = (
  criteria: Record<string, any>,
  productCode: string,
) => {
  const bridgeProduct = isBridgeLoanProduct(productCode);
  const fixAndFlipProduct = isFixAndFlipProduct(productCode);
  const dscrRentalProduct = isDscrRentalProduct(productCode);
  const rentalPortfolioProduct = isRentalPortfolioProduct(productCode);
  const constructionProduct = isConstructionLoanProduct(productCode);
  const crePermanentProduct = isCrePermanentProduct(productCode);
  const cmbsProduct = isCmbsProduct(productCode);
  const agencyMultifamilyProduct = isAgencyMultifamilyProduct(productCode);
  const mezzanineProduct = isMezzanineProduct(productCode);
  const preferredEquityProduct = isPreferredEquityProduct(productCode);
  const sba7aGeneralProduct = isSba7aGeneralProduct(productCode);
  const sba7aBusinessAcquisitionProduct =
    isSba7aBusinessAcquisitionProduct(productCode);
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
      (purchaseOrderProduct || arFactoringProduct) &&
      criteria.minFacilitySize !== undefined &&
      criteria.minFacilitySize !== ""
        ? Number(criteria.minFacilitySize)
        : apSupplyChainProduct &&
            criteria.minProgramSize !== undefined &&
            criteria.minProgramSize !== ""
          ? Number(criteria.minProgramSize)
          : !noMinLoanProduct &&
              criteria.minLoan !== undefined &&
              criteria.minLoan !== ""
            ? Number(criteria.minLoan)
            : null,
    maxLoanAmount:
      (purchaseOrderProduct || arFactoringProduct) &&
      criteria.maxFacilitySize !== undefined &&
      criteria.maxFacilitySize !== ""
        ? Number(criteria.maxFacilitySize)
        : apSupplyChainProduct &&
            criteria.maxProgramSize !== undefined &&
            criteria.maxProgramSize !== ""
          ? Number(criteria.maxProgramSize)
          : !sba504Product &&
              criteria.maxLoan !== undefined &&
              criteria.maxLoan !== ""
            ? Number(criteria.maxLoan)
            : null,
    minTermMonths: noTermProduct
      ? null
      : toTermMonths(criteria.minTerm, productCode),
    maxTermMonths: noTermProduct
      ? null
      : toTermMonths(criteria.maxTerm, productCode),
    maxLtvPercent:
      !mezzanineProduct &&
      !preferredEquityProduct &&
      !noPropertyMetricsProduct &&
      criteria.maxLtv !== undefined &&
      criteria.maxLtv !== ""
        ? Number(criteria.maxLtv)
        : null,
    minMezzLtvPercent:
      criteria.minLtv !== undefined && criteria.minLtv !== ""
        ? Number(criteria.minLtv)
        : mezzanineProduct &&
            criteria.mezzLtvMin !== undefined &&
            criteria.mezzLtvMin !== ""
          ? Number(criteria.mezzLtvMin)
          : null,
    maxMezzLtvPercent:
      mezzanineProduct &&
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
      (sba7aBusinessAcquisitionProduct || sba504Product) &&
      criteria.requiredInjection !== undefined &&
      criteria.requiredInjection !== ""
        ? Number(criteria.requiredInjection)
        : null,
    goodwillFinancingAllowed: sba7aBusinessAcquisitionProduct
      ? Boolean(criteria.goodwillFinancingAllowed)
      : false,
    sellerFinancingAllowed: sba7aBusinessAcquisitionProduct
      ? Boolean(criteria.sellerFinancingAllowed)
      : false,
    minLiquidityRequirement:
      sba7aBusinessAcquisitionProduct &&
      criteria.minLiquidityRequirement?.trim()
        ? criteria.minLiquidityRequirement.trim()
        : null,
    minTimeInBusinessMonths:
      (sba7aWorkingCapitalProduct ||
        sba7aEquipmentPurchaseProduct ||
        sba504Product) &&
      criteria.minTimeInBusiness !== undefined &&
      criteria.minTimeInBusiness !== ""
        ? Number(criteria.minTimeInBusiness)
        : null,
    minAnnualRevenue:
      sba7aWorkingCapitalProduct &&
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
      sba7aWorkingCapitalProduct ||
      sba7aEquipmentPurchaseProduct ||
      sba504Product
        ? Boolean(criteria.startupAllowed)
        : false,
    rateStructure:
      sba504Product && criteria.rateStructure?.trim()
        ? criteria.rateStructure.trim()
        : null,
    refinanceAllowed: sba504Product
      ? Boolean(criteria.refinanceAllowed)
      : false,
    workingCapitalEligible: sba504Product
      ? Boolean(criteria.workingCapitalEligible)
      : false,
    lifeInsuranceMayBeRequired: sba504Product
      ? Boolean(criteria.lifeInsuranceMayBeRequired)
      : false,
    lineOfCreditAvailable: sba7aWorkingCapitalProduct
      ? Boolean(criteria.lineOfCreditAvailable)
      : false,
    usedEquipmentAllowed:
      sba7aEquipmentPurchaseProduct || equipmentFinanceProduct
        ? Boolean(criteria.usedEquipmentAllowed)
        : false,
    saleLeasebackAvailable: equipmentFinanceProduct
      ? Boolean(criteria.saleLeasebackAvailable)
      : false,
    advanceRatePercent:
      (purchaseOrderProduct || arFactoringProduct) &&
      criteria.advanceRate !== undefined &&
      criteria.advanceRate !== ""
        ? Number(criteria.advanceRate)
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
      criteria.discountFee !== undefined &&
      criteria.discountFee !== ""
        ? Number(criteria.discountFee)
        : null,
    maxInvoiceAgeDays:
      arFactoringProduct &&
      criteria.maxInvoiceAgeDays !== undefined &&
      criteria.maxInvoiceAgeDays !== ""
        ? Number(criteria.maxInvoiceAgeDays)
        : null,
    nonRecourseAvailable: arFactoringProduct
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
      sba7aRealEstateProduct || sba504Product
        ? Boolean(criteria.ownerOccupiedRequired)
        : false,
    ownerOccupancyRequirement:
      (sba7aRealEstateProduct || sba504Product) &&
      criteria.ownerOccupancyRequirement?.trim()
        ? criteria.ownerOccupancyRequirement.trim()
        : null,
    environmentalReportRequired:
      sba7aRealEstateProduct || sba504Product
        ? Boolean(criteria.environmentalReportRequired)
        : false,
    appraisalRequired:
      sba7aRealEstateProduct || sba504Product
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
      criteria.preferredReturn !== undefined &&
      criteria.preferredReturn !== ""
        ? Number(criteria.preferredReturn)
        : null,
    maxArvPercent:
      !bridgeProduct &&
      !dscrRentalProduct &&
      !rentalPortfolioProduct &&
      !constructionProduct &&
      !crePermanentProduct &&
      !cmbsProduct &&
      !agencyMultifamilyProduct &&
      !mezzanineProduct &&
      !preferredEquityProduct &&
      !noPropertyMetricsProduct &&
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
      (dscrRentalProduct ||
        rentalPortfolioProduct ||
        crePermanentProduct ||
        cmbsProduct ||
        agencyMultifamilyProduct ||
        isAnySba7aProduct(productCode) ||
        sba504Product) &&
      criteria.minDscr !== undefined &&
      criteria.minDscr !== ""
        ? Number(criteria.minDscr)
        : null,
    minDebtYieldPercent:
      (crePermanentProduct || cmbsProduct) &&
      criteria.minDebtYield !== undefined &&
      criteria.minDebtYield !== ""
        ? Number(criteria.minDebtYield)
        : null,
    amortizationYears:
      (crePermanentProduct ||
        cmbsProduct ||
        agencyMultifamilyProduct) &&
      criteria.amortizationYears !== undefined &&
      criteria.amortizationYears !== ""
        ? Number(criteria.amortizationYears)
        : null,
    minUnits:
      agencyMultifamilyProduct &&
      criteria.minUnits !== undefined &&
      criteria.minUnits !== ""
        ? Number(criteria.minUnits)
        : null,
    prepaymentStructure:
      (cmbsProduct ||
        sba7aWorkingCapitalProduct ||
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
      sba504Product && criteria.interestRateNote?.trim()
        ? criteria.interestRateNote.trim()
        : !preferredEquityProduct &&
            !noMinLoanProduct &&
            !purchaseOrderProduct &&
            !arFactoringProduct &&
            !apSupplyChainProduct &&
            criteria.minRate &&
            criteria.maxRate
          ? `${criteria.minRate}-${criteria.maxRate}`
          : null,
    originationPointsPercent:
      criteria.originationPoints !== undefined &&
      criteria.originationPoints !== ""
        ? Number(criteria.originationPoints)
        : null,
    extensionAvailable: bridgeProduct
      ? Boolean(criteria.extensionAvailable)
      : false,
    personalGuaranteeRequired:
      bridgeProduct || isAnySbaProduct(productCode)
        ? Boolean(criteria.personalGuaranteeRequired)
        : false,
    firstTimeBorrowersAllowed: fixAndFlipProduct
      ? Boolean(criteria.firstTimeBorrowersAllowed)
      : false,
    interestOnlyAvailable: dscrRentalProduct
      ? Boolean(criteria.interestOnlyAvailable)
      : false,
    shortTermRentalsOk: dscrRentalProduct
      ? Boolean(criteria.shortTermRentalsOk)
      : false,
    foreignNationalsAllowed: dscrRentalProduct
      ? Boolean(criteria.foreignNationalsAllowed)
      : false,
    gcRequired: constructionProduct
      ? Boolean(criteria.gcRequired)
      : false,
    completionGuaranteeRequired: constructionProduct
      ? Boolean(criteria.completionGuaranteeRequired)
      : false,
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
  if (!range || typeof range !== "string") {
    return { minRate: "", maxRate: "" };
  }

  const [minPart = "", maxPart = ""] = range.split("-");
  const clean = (part: string) =>
    part.replace(/,/g, "").replace(/%/g, "").trim();

  return {
    minRate: clean(minPart),
    maxRate: clean(maxPart),
  };
};

export const mapApiProductToCriteriaForm = (product: any) => {
  const productCode = product.loanProductCode || product.code || "";
  const toFormValue = apiToFormValue;
  const toFormBoolean = (val: unknown) => val === true;
  const interestRates = parseInterestRateRange(product.interestRateRange);

  return {
    minLoan: isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
      ? ""
      : isApSupplyChainProduct(productCode)
        ? ""
        : toFormValue(product.minLoanAmount),
    maxLoan: isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
      ? ""
      : isApSupplyChainProduct(productCode)
        ? ""
        : toFormValue(product.maxLoanAmount),
    minFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
        ? toFormValue(product.minLoanAmount)
        : "",
    maxFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
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
    transactionFee: toFormValue(product.transactionFeePercent),
    minGrossMargin: toFormValue(product.minGrossMarginPercent),
    internationalPosAllowed: Boolean(product.internationalPosAllowed),
    discountFee: toFormValue(product.discountFeePercent),
    maxInvoiceAgeDays: toFormValue(product.maxInvoiceAgeDays),
    nonRecourseAvailable: Boolean(product.nonRecourseAvailable),
    governmentInvoicesOk: Boolean(product.governmentInvoicesOk),
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
    maxLtv: toFormValue(product.maxLtvPercent),
    maxArv: toFormValue(product.maxArvPercent),
    maxLtc: toFormValue(product.maxLtcPercent),
    fico: toFormValue(product.minCreditScore),
    minDscr: toFormValue(product.minDscr),
    minDebtYield: toFormValue(product.minDebtYieldPercent),
    amortizationYears: toFormValue(product.amortizationYears),
    minUnits: toFormValue(product.minUnits),
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
    gcRequired: toFormBoolean(product.gcRequired),
    completionGuaranteeRequired: toFormBoolean(
      product.completionGuaranteeRequired,
    ),
    criteriaNotes: product.criteriaNotes ?? "",
    states: Array.isArray(product.statesSupported)
      ? product.statesSupported
      : product.statesSupported
        ? String(product.statesSupported).split(",").filter(Boolean)
        : [],
    documents: normalizeDocumentsForForm(product),
    minRate:
      isSba504Product(productCode) || isSba7aRateSpreadProduct(productCode)
        ? ""
        : interestRates.minRate,
    maxRate:
      isSba504Product(productCode) || isSba7aRateSpreadProduct(productCode)
        ? ""
        : interestRates.maxRate,
  };
};
