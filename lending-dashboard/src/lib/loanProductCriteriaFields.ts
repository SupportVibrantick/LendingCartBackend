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
  /** Allow decimal values (e.g. Min DSCR) */
  decimal?: boolean;
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const CRE_PERMANENT_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min Debt Yield (%)", key: "minDebtYield", required: true },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const CMBS_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Loan Amount ($)", key: "minLoan", required: true },
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min Rate (%)", key: "minRate", required: true },
  { label: "Max Rate (%)", key: "maxRate", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
  { label: "Min DSCR", key: "minDscr", required: true, decimal: true },
  { label: "Min Debt Yield (%)", key: "minDebtYield", required: true },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const PREFERRED_EQUITY_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Min Investment ($)", key: "minLoan", required: true },
  { label: "Max Investment ($)", key: "maxLoan", required: true },
  { label: "Preferred Return (%)", key: "preferredReturn", required: true },
  { label: "Min Term (months)", key: "minTerm", required: true },
  { label: "Max Term (months)", key: "maxTerm", required: true },
  { label: "Origination Fee (%)", key: "originationPoints", required: true },
  { label: "Exit Fee (%)", key: "exitFee", required: true },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_GENERAL_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Min FICO Score", key: "fico", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
  { label: "Avg Turnaround (days)", key: "avgTurnaroundDays", required: true },
  {
    label: "Preferred Lender (PLP)",
    key: "preferredLenderPlp",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_BUSINESS_ACQUISITION_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
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
  { label: "Required Injection (%)", key: "requiredInjection", required: true },
  {
    label: "Goodwill Financing Allowed",
    key: "goodwillFinancingAllowed",
    type: "toggle",
    required: false,
  },
  {
    label: "Seller Financing Allowed",
    key: "sellerFinancingAllowed",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_WORKING_CAPITAL_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
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
  {
    label: "Min Time In Business (months)",
    key: "minTimeInBusiness",
    required: true,
  },
  {
    label: "Line of Credit Available",
    key: "lineOfCreditAvailable",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_EQUIPMENT_PURCHASE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
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
  {
    label: "Used Equipment Allowed",
    key: "usedEquipmentAllowed",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_7A_REAL_ESTATE_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Loan Amount ($)", key: "maxLoan", required: true },
  { label: "Max Rate Spread (%)", key: "maxRateSpread", required: true },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
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
  {
    label: "Owner-Occupied Required",
    key: "ownerOccupiedRequired",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
];

const SBA_504_CRITERIA_FIELDS: CriteriaField[] = [
  { label: "Max Total Project ($)", key: "maxTotalProject", required: true },
  {
    label: "Max SBA 504 Debenture ($)",
    key: "maxSba504Debenture",
    required: true,
  },
  { label: "Max LTV (%)", key: "maxLtv", required: true },
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
  {
    label: "Job Creation Required",
    key: "jobCreationRequired",
    type: "toggle",
    required: false,
  },
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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
  { label: "Notes", key: "criteriaNotes", type: "textarea", required: false },
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

export const isNoMinLoanCriteriaProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode) ||
  isSba504Product(productCode) ||
  isUsdaBiProduct(productCode);

export const isSba7aNoLtvProduct = (productCode?: string | null) =>
  isSba7aMaxLoanOnlyProduct(productCode) &&
  !isSba7aRealEstateProduct(productCode);

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

export const getCriteriaFieldsForProduct = (
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

export const getRequiredCriteriaKeysForProduct = (
  productCode: string,
): string[] =>
  getCriteriaFieldsForProduct(productCode)
    .filter((field) => field.required !== false && field.type !== "toggle")
    .map((field) => field.key);

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
      mezzanineProduct &&
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
    maxRateSpreadPercent:
      isSba7aRateSpreadProduct(productCode) &&
      criteria.maxRateSpread !== undefined &&
      criteria.maxRateSpread !== ""
        ? Number(criteria.maxRateSpread)
        : null,
    avgTurnaroundDays:
      sba7aGeneralProduct &&
      criteria.avgTurnaroundDays !== undefined &&
      criteria.avgTurnaroundDays !== ""
        ? Number(criteria.avgTurnaroundDays)
        : null,
    preferredLenderPlp: sba7aGeneralProduct
      ? Boolean(criteria.preferredLenderPlp)
      : false,
    requiredInjectionPercent:
      sba7aBusinessAcquisitionProduct &&
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
    minTimeInBusinessMonths:
      sba7aWorkingCapitalProduct &&
      criteria.minTimeInBusiness !== undefined &&
      criteria.minTimeInBusiness !== ""
        ? Number(criteria.minTimeInBusiness)
        : null,
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
    ownerOccupiedRequired: sba7aRealEstateProduct
      ? Boolean(criteria.ownerOccupiedRequired)
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
      !dscrRentalProduct &&
      !rentalPortfolioProduct &&
      !crePermanentProduct &&
      !cmbsProduct &&
      !agencyMultifamilyProduct &&
      !mezzanineProduct &&
      !preferredEquityProduct &&
      !noPropertyMetricsProduct &&
      criteria.maxLtc !== undefined &&
      criteria.maxLtc !== ""
        ? Number(criteria.maxLtc)
        : null,
    minCreditScore:
      !purchaseOrderProduct &&
      !arFactoringProduct &&
      !apSupplyChainProduct &&
      !cmbsProduct &&
      !agencyMultifamilyProduct &&
      !mezzanineProduct &&
      !preferredEquityProduct &&
      criteria.fico !== undefined &&
      criteria.fico !== ""
        ? Number(criteria.fico)
        : null,
    minDscr:
      (dscrRentalProduct ||
        rentalPortfolioProduct ||
        crePermanentProduct ||
        cmbsProduct ||
        agencyMultifamilyProduct) &&
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
      cmbsProduct && criteria.prepaymentStructure?.trim()
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
      !bridgeProduct &&
      !fixAndFlipProduct &&
      !dscrRentalProduct &&
      !rentalPortfolioProduct &&
      !constructionProduct &&
      !crePermanentProduct &&
      !cmbsProduct &&
      !agencyMultifamilyProduct &&
      !mezzanineProduct &&
      !preferredEquityProduct &&
      !noPropertyMetricsProduct &&
      criteria.experience !== undefined &&
      criteria.experience !== ""
        ? String(criteria.experience)
        : null,
    interestRateRange:
      !preferredEquityProduct &&
      !noMinLoanProduct &&
      !purchaseOrderProduct &&
      !arFactoringProduct &&
      !apSupplyChainProduct &&
      criteria.minRate &&
      criteria.maxRate
        ? `${criteria.minRate}-${criteria.maxRate}`
        : null,
    originationPointsPercent:
      !rentalPortfolioProduct &&
      !cmbsProduct &&
      !agencyMultifamilyProduct &&
      !noPropertyMetricsProduct &&
      criteria.originationPoints !== undefined &&
      criteria.originationPoints !== ""
        ? Number(criteria.originationPoints)
        : null,
    extensionAvailable: bridgeProduct
      ? Boolean(criteria.extensionAvailable)
      : false,
    personalGuaranteeRequired: bridgeProduct
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

export const mapApiProductToCriteriaForm = (product: any) => {
  const productCode = product.loanProductCode || product.code || "";

  return {
    minLoan: isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
      ? ""
      : isApSupplyChainProduct(productCode)
        ? ""
        : (product.minLoanAmount ?? ""),
    maxLoan: isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
      ? ""
      : isApSupplyChainProduct(productCode)
        ? ""
        : (product.maxLoanAmount ?? ""),
    minFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
        ? (product.minLoanAmount ?? "")
        : "",
    maxFacilitySize:
      isPurchaseOrderFinanceProduct(productCode) ||
      isArFactoringProduct(productCode)
        ? (product.maxLoanAmount ?? "")
        : "",
    minProgramSize: isApSupplyChainProduct(productCode)
      ? (product.minLoanAmount ?? "")
      : "",
    maxProgramSize: isApSupplyChainProduct(productCode)
      ? (product.maxLoanAmount ?? "")
      : "",
    minTerm: fromTermMonths(product.minTermMonths, productCode),
    maxTerm: fromTermMonths(product.maxTermMonths, productCode),
    maxRateSpread: product.maxRateSpreadPercent ?? "",
    avgTurnaroundDays: product.avgTurnaroundDays ?? "",
    preferredLenderPlp: Boolean(product.preferredLenderPlp),
    requiredInjection: product.requiredInjectionPercent ?? "",
    goodwillFinancingAllowed: Boolean(product.goodwillFinancingAllowed),
    sellerFinancingAllowed: Boolean(product.sellerFinancingAllowed),
    minTimeInBusiness: product.minTimeInBusinessMonths ?? "",
    lineOfCreditAvailable: Boolean(product.lineOfCreditAvailable),
    usedEquipmentAllowed: Boolean(product.usedEquipmentAllowed),
    saleLeasebackAvailable: Boolean(product.saleLeasebackAvailable),
    advanceRate: product.advanceRatePercent ?? "",
    transactionFee: product.transactionFeePercent ?? "",
    minGrossMargin: product.minGrossMarginPercent ?? "",
    internationalPosAllowed: Boolean(product.internationalPosAllowed),
    discountFee: product.discountFeePercent ?? "",
    maxInvoiceAgeDays: product.maxInvoiceAgeDays ?? "",
    nonRecourseAvailable: Boolean(product.nonRecourseAvailable),
    governmentInvoicesOk: Boolean(product.governmentInvoicesOk),
    earlyPaymentDiscount: product.earlyPaymentDiscountPercent ?? "",
    paymentTermsExtensionDays: product.paymentTermsExtensionDays ?? "",
    dynamicDiscountingAvailable: Boolean(product.dynamicDiscountingAvailable),
    reverseFactoringAvailable: Boolean(product.reverseFactoringAvailable),
    ownerOccupiedRequired: Boolean(product.ownerOccupiedRequired),
    maxTotalProject: product.maxTotalProjectAmount ?? "",
    maxSba504Debenture: product.maxSba504DebentureAmount ?? "",
    jobCreationRequired: Boolean(product.jobCreationRequired),
    maxUsdaGuarantee: product.maxUsdaGuaranteeAmount ?? "",
    usdaGuaranteePercent: product.usdaGuaranteePercent ?? "",
    ruralAreaRequired: Boolean(product.ruralAreaRequired),
    preferredReturn: product.preferredReturnPercent ?? "",
    mezzLtvMin: product.minMezzLtvPercent ?? "",
    mezzLtvMax: product.maxMezzLtvPercent ?? "",
    exitFee: product.exitFeePercent ?? "",
    maxLtv: product.maxLtvPercent ?? "",
    maxArv: product.maxArvPercent ?? "",
    maxLtc: product.maxLtcPercent ?? "",
    fico: product.minCreditScore ?? "",
    minDscr: product.minDscr ?? "",
    minDebtYield: product.minDebtYieldPercent ?? "",
    amortizationYears: product.amortizationYears ?? "",
    minUnits: product.minUnits ?? "",
    prepaymentStructure: product.prepaymentStructure ?? "",
    minProperties: product.minPropertiesInPortfolio ?? "",
    maxProperties: product.maxPropertiesInPortfolio ?? "",
    experience: product.minExperience ?? "",
    originationPoints: product.originationPointsPercent ?? "",
    extensionAvailable: Boolean(product.extensionAvailable),
    personalGuaranteeRequired: Boolean(product.personalGuaranteeRequired),
    firstTimeBorrowersAllowed: Boolean(product.firstTimeBorrowersAllowed),
    interestOnlyAvailable: Boolean(product.interestOnlyAvailable),
    shortTermRentalsOk: Boolean(product.shortTermRentalsOk),
    foreignNationalsAllowed: Boolean(product.foreignNationalsAllowed),
    gcRequired: Boolean(product.gcRequired),
    completionGuaranteeRequired: Boolean(product.completionGuaranteeRequired),
    criteriaNotes: product.criteriaNotes ?? "",
    states: Array.isArray(product.statesSupported)
      ? product.statesSupported
      : product.statesSupported
        ? String(product.statesSupported).split(",").filter(Boolean)
        : [],
    documents: product.documents || [],
    minRate: product.interestRateRange?.split("-")[0] || "",
    maxRate: product.interestRateRange?.split("-")[1]?.replace("%", "") || "",
  };
};
