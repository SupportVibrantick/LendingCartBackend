const METRIC_FIELD_KEYS = new Set([
  "ltvPercentage",
  "ltcPercentage",
  "arvPercentage",
  "dscr",
  "netWorth",
]);

const STATIC_SUBMIT_FIELD_KEYS = new Set([
  "borrowerFirstName",
  "borrowerLastName",
  "companyName",
  "email",
  "phone",
  "creditScore",
  "borrowerCity",
  "borrowerState",
  "borrowerCountry",
  "dob",
  "ssn",
  "address",
  "mailingAddress",
  "employer",
  "loanProductCode",
  "amountRequested",
  "interestRate",
  "purpose",
  "propertyType",
  "subPropertyType",
  "recourse",
  "propertyAddress",
  "propertyCity",
  "propertyState",
  "propertyZip",
  "propertyCountry",
  "loanTerm",
  "noiActual",
  "entityLegalName",
  "entityType",
  "dba",
  "formationDate",
  "yearsInBusiness",
  "currentMarketValue",
  "afterRepairValue",
  "purchasePrice",
  "purchaseDate",
  "totalAssets",
  "totalLiabilities",
  "monthlyRent",
  "interimMonthsReported",
  "grossRevenueActual",
  "grossRevenueProforma",
  "noiProforma",
  "annualTaxes",
  "floodZone",
  "insurancePremium",
  "hoaDues",
  "rehabBudget",
  "estimatedRepairMonths",
  "exitStrategy",
  ...METRIC_FIELD_KEYS,
]);

const FIELD_LABELS: Record<string, string> = {
  borrowerFirstName: "First Name",
  borrowerLastName: "Last Name",
  companyName: "Company Name",
  rehabBudget: "Rehab Budget",
  estimatedRepairMonths: "Estimated Repair Months",
  exitStrategy: "Exit Strategy",
  floodZone: "Property in Flood Zone",
  entityLegalName: "Entity Legal Name",
  grossRevenueActual: "Gross Revenue (Actual)",
  grossRevenueProforma: "Gross Revenue (Proforma)",
  noiActual: "NOI Actual",
  noiProforma: "NOI Proforma",
  loanProductCode: "Loan Product",
  interimMonthsReported: "Months Reported (Interim Year)",
  businessIndustry: "Business / Industry Type",
  business_industry: "Business / Industry Type",
  naicsCode: "Industry Code (NAICS)",
  naics: "Industry Code (NAICS)",
  annualTaxes: "Annual Property Taxes",
  annualPropertyTaxes: "Annual Property Taxes",
  insurancePremium: "Annual Insurance",
  annualInsurance: "Annual Insurance",
  inFloodZone: "Property in Flood Zone",
  dscrCalculationMethod: "DSCR Calculation Method",
  hasRentalIncome: "Has Rental Income",
  rentalProperty: "Rental Property",
  proFormaNoiAverage: "Pro Forma NOI (Average)",
  projectSummary: "Project Summary",
  totalAssets: "Total Assets",
  totalLiabilities: "Total Liabilities",
  totalCashReserves: "Total Cash Reserves",
  existingDebt: "Existing Debt",
  sreoTotalMarketValue: "Total Market Value (Real Estate Owned)",
  useOfFunds: "Use of Funds",
  sellerFinancing: "Seller Financing",
  sellerNoteAmount: "Seller Note Amount",
  downPayment: "Down Payment",
  constructionBudget: "Construction Budget",
  currentMarketValue: "Current Market Value",
  afterRepairValue: "After Repair Value",
  purchasePrice: "Purchase Price",
  purchaseDate: "Purchase Date",
  numberOfUnits: "Number of Units",
  additionalCollateral: "Additional Collateral",
  privateSale: "Private Sale",
  vendorName: "Equipment Vendor / Dealer / Seller",
  vendorPhone: "Vendor / Dealer / Seller Phone",
  creditAuthorizationConsent: "Credit Authorization Consent",
};

/**
 * Alias groups: first key is preferred when multiple equivalent fields exist.
 * Used to prevent duplicates like businessIndustry + business_industry.
 */
const FIELD_ALIAS_GROUPS: string[][] = [
  ["businessIndustry", "business_industry"],
  ["naicsCode", "naics", "naics_code"],
  ["annualPropertyTaxes", "annualTaxes"],
  ["annualInsurance", "insurancePremium"],
  ["inFloodZone", "floodZone"],
  ["proFormaNoiAverage", "noiProforma"],
];

const ASSET_LINE_LABELS: Record<string, string> = {
  cashOnHand: "Cash on Hand & in Banks",
  savingsAccounts: "Savings Accounts",
  iraRetirement: "IRA or Other Retirement Account",
  accountsReceivable: "Accounts & Notes Receivable",
  lifeInsuranceCashValue: "Life Insurance Cash Surrender Value",
  stocksAndBonds: "Stocks and Bonds",
  realEstate: "Real Estate",
  automobileValue: "Automobile Present Value",
  otherPersonalProperty: "Other Personal Property",
  otherAssets: "Other Assets",
};

const LIABILITY_LINE_LABELS: Record<string, string> = {
  accountsPayable: "Accounts Payable",
  notesPayable: "Notes Payable to Bank and Others",
  autoMonthlyPayments: "Auto Monthly Payments",
  otherInstallmentPayments: "Other Installment Account Payments",
  loanOnLifeInsurance: "Loan on Life Insurance",
  mortgagesOnRealEstate: "Mortgages on Real Estate",
  unpaidTaxes: "Unpaid Taxes",
  otherLiabilities: "Other Liabilities",
};

const DECLARATION_LINE_LABELS: Record<string, string> = {
  outstandingJudgments: "Outstanding judgments against you?",
  declaredBankrupt: "Declared bankrupt in past 7 years?",
  propertyForeclosed: "Property foreclosed or deed in lieu in last 7 years?",
  partyToLawsuit: "Party to a lawsuit?",
  obligatedOnForeclosureLoan:
    "Obligated on any loan resulting in foreclosure or judgment?",
  delinquentFederalDebt:
    "Presently delinquent or in default on any federal debt?",
  convictedFelony: "Convicted of a felony in past 10 years?",
  usCitizen: "Are you a US citizen?",
  permanentResidentAlien: "Are you a permanent resident alien?",
  intendToOccupy: "Do you intend to occupy the subject property?",
};

const FINANCIAL_ROW_LABELS: Record<string, string> = {
  grossRevenue: "Gross Revenue",
  grossRentalIncome: "Gross Rental Income",
  vacancyCreditLoss: "Vacancy & Credit Loss",
  operatingExpenses: "Operating Expenses",
  mortgageDebtService: "Mortgage / Debt Service",
  effectiveGrossIncomeOverride: "Effective Gross Income",
  noiOverride: "NOI (Net Operating Income)",
  cashFlowAfterDebtOverride: "Cash Flow After Debt Service",
};

const SREO_LINE_LABELS: Record<string, string> = {
  propertyAddress: "Property Address",
  entityNameOnTitle: "Entity Name on Title",
  ownershipPercent: "Ownership %",
  propertyType: "Property Type",
  acquisitionDate: "Acquisition Date",
  rehabUpgradeCost: "Rehab / Upgrade Cost",
  currentMarketValue: "Current Market Value",
  mortgageHolderNameAddress: "Mortgage Holder",
  loanMortgageBalance: "Loan / Mortgage Balance",
  grossRentalIncome: "Gross Rental Income",
  loanTaxInsurancePaymentYr: "Annual Tax & Insurance Payment",
  noiPerYear: "NOI per Year",
  totalEquity: "Total Equity",
};

const FIELD_ALIAS_TO_CANONICAL = (() => {
  const map = new Map<string, string>();
  for (const group of FIELD_ALIAS_GROUPS) {
    const canonical = group[0];
    for (const key of group) {
      map.set(key, canonical);
    }
  }
  return map;
})();

function getFieldAliasCanonical(fieldKey: string) {
  return FIELD_ALIAS_TO_CANONICAL.get(fieldKey) || fieldKey;
}

export function getLatestSubmission(submissions: any[] = []) {
  if (!submissions.length) return null;

  const active = submissions
    .filter((submission) => submission.status !== "SUPERSEDED")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return active[0] || submissions[submissions.length - 1];
}

export function buildSubmissionFieldMap(applicationData: any) {
  const map: Record<string, any> = {};
  const latest = getLatestSubmission(applicationData?.submissions || []);

  const topLevelFields: Record<string, any> = {
    borrowerName: applicationData?.borrowerName,
    borrowerEmail: applicationData?.borrowerEmail,
    borrowerPhone: applicationData?.borrowerPhone,
    email: applicationData?.borrowerEmail,
    phone: applicationData?.borrowerPhone,
    propertyAddress: applicationData?.propertyAddress,
    loanProductCode: applicationData?.loanProductCode,
    amountRequested: applicationData?.amountRequested,
    borrowerSignature: applicationData?.borrowerSignature,
  };

  Object.entries(topLevelFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      map[key] = value;
    }
  });

  latest?.fields?.forEach((field: any) => {
    const fieldKey = field.fieldKey ?? field.builderField?.fieldKey;
    if (!fieldKey) return;
    const rawValue = field.value;
    map[fieldKey] =
      typeof rawValue === "string" || typeof rawValue === "number"
        ? rawValue
        : rawValue ?? null;
  });

  if (applicationData?.latestSubmission?.fields?.length) {
    applicationData.latestSubmission.fields.forEach((field: any) => {
      const fieldKey = field.fieldKey ?? field.builderField?.fieldKey;
      if (!fieldKey) return;
      map[fieldKey] = field.value;
    });
  }

  for (const submission of applicationData?.submissions || []) {
    const signatureField = submission.fields?.find(
      (field: any) => field.fieldKey === "borrowerSignature" && field.value,
    );
    if (signatureField) {
      map.borrowerSignature = signatureField.value;
      break;
    }
  }

  return map;
}

export function parseNumericValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function humanizeFieldKey(fieldKey: string) {
  return fieldKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripCoBorrowerPrefix(fieldKey: string) {
  return fieldKey.replace(/^coBorrower_\d+_/, "");
}

export function formatFieldLabel(fieldKey: string, yearLabel?: string) {
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];

  const bare = stripCoBorrowerPrefix(fieldKey);
  if (FIELD_LABELS[bare]) return FIELD_LABELS[bare];

  const asset = bare.match(/^asset_(.+)$/i);
  if (asset) return ASSET_LINE_LABELS[asset[1]] || humanizeFieldKey(asset[1]);

  const liability = bare.match(/^liability_(.+)$/i);
  if (liability) {
    return LIABILITY_LINE_LABELS[liability[1]] || humanizeFieldKey(liability[1]);
  }

  const declaration = bare.match(/^declaration_(.+)$/i);
  if (declaration) {
    return (
      DECLARATION_LINE_LABELS[declaration[1]] || humanizeFieldKey(declaration[1])
    );
  }

  const sreo = bare.match(/^sreo_(\d+)_(.+)$/i);
  if (sreo) {
    const line = SREO_LINE_LABELS[sreo[2]] || humanizeFieldKey(sreo[2]);
    return `Property ${Number(sreo[1]) + 1} · ${line}`;
  }

  const financial = bare.match(/^financial_(.+)_col(\d+)(?:_computed)?$/i);
  if (financial) {
    const row =
      FINANCIAL_ROW_LABELS[financial[1]] ||
      humanizeFieldKey(financial[1].replace(/Override$/i, ""));
    const column =
      yearLabel || (financial[2] === "0" ? "Interim" : `Year ${financial[2]}`);
    return `${row} (${column})`;
  }

  const proForma = bare.match(/^proFormaNoi_year_(\d+)$/i);
  if (proForma) return `Pro Forma NOI (Year ${proForma[1]})`;

  return humanizeFieldKey(bare);
}

export function formatFieldDisplayValue(fieldKey: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "-";

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "-";
  }

  const bareKey = stripCoBorrowerPrefix(fieldKey);
  if (bareKey === "dscrCalculationMethod") {
    const method = String(value).trim();
    if (method === "noi") return "NOI";
    if (method === "proForma") return "Pro Forma";
  }

  const normalizedYesNo = String(value).trim().toLowerCase();
  if (normalizedYesNo === "yes") return "Yes";
  if (normalizedYesNo === "no") return "No";

  if (bareKey === "floodZone" || bareKey === "inFloodZone") {
    if (normalizedYesNo === "yes") return "Yes";
    if (normalizedYesNo === "no") return "No";
  }

  if (
    /amount|price|value|rent|tax|premium|dues|assets?|liabilit|networth|budget|revenue|noi|income|expense|loss|payable|receivable|reserve|equity|mortgage|debt|cashflow|service/i.test(
      fieldKey,
    )
  ) {
    const numeric = parseNumericValue(value);
    if (numeric !== null) {
      return `$${numeric.toLocaleString("en-US")}`;
    }
  }

  if (/percentage|ltv|ltc|arv|rate|score|dscr|term|months/i.test(fieldKey)) {
    const numeric = parseNumericValue(value);
    if (numeric !== null) {
      return String(value).includes("%") ? String(value) : String(numeric);
    }
  }

  if (fieldKey === "loanProductCode" || fieldKey === "loanCategory" || fieldKey === "recourse") {
    return formatEnumLikeDisplayValue(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  const stringValue = String(value).trim();
  if (stringValue.includes("_")) {
    return formatEnumLikeDisplayValue(stringValue);
  }

  return stringValue;
}

export function getCoBorrowerGroups(fieldMap: Record<string, any>) {
  const groups: Record<string, Record<string, any>> = {};

  Object.entries(fieldMap).forEach(([key, value]) => {
    const match = key.match(/^coBorrower_(\d+)_(.+)$/);
    if (!match) return;

    const index = match[1];
    const fieldName = match[2];
    if (!groups[index]) groups[index] = {};
    groups[index][fieldName] = value;
  });

  return groups;
}

export function getAdditionalFields(fieldMap: Record<string, any>) {
  return Object.entries(fieldMap).filter(([key]) => {
    if (!key || key === "borrowerSignature") return false;
    if (key.startsWith("coBorrower_")) return false;
    if (STATIC_SUBMIT_FIELD_KEYS.has(key)) return false;
    return true;
  });
}

export const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  MEZZANINE_LOAN: "MEZZANINE",
  PREFERRED_EQUITY: "PREFERRED EQUITY",
  WORKING_CAPITAL: "WORKING CAPITAL",
  EQUIPMENT_FINANCING: "EQUIPMENT",
  PURCHASE_ORDER_FINANCING: "PURCHASE ORDER",
};

const ENUM_VALUE_LABELS: Record<string, string> = {
  ...PRODUCT_LABELS,
  RESIDENTIAL_1_4: "1-4 Units Residential",
  CRE_MULTIFAMILY: "CRE & Multifamily",
  SBA_USDA: "SBA & USDA",
  ABL: "Asset Based Lending",
  FULL_RECOURSE: "Full Recourse",
  NON_RECOURSE: "Non-Recourse",
};

function formatEnumLikeDisplayValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";

  if (ENUM_VALUE_LABELS[raw]) return ENUM_VALUE_LABELS[raw];

  if (raw.includes("_")) {
    return raw
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return raw;
}

export type SubmissionDetailField = {
  fieldId?: string | null;
  fieldKey?: string | null;
  label?: string | null;
  type?: string | null;
  value: string;
  sectionName?: string | null;
  sectionSortOrder?: number | null;
  fieldSortOrder?: number | null;
};

export type SubmissionFieldSection = {
  id: string;
  title: string;
  sortOrder: number;
  fields: SubmissionDetailField[];
};

const METRIC_ONLY_FIELD_KEYS = new Set([
  "ltvPercentage",
  "ltcPercentage",
  "arvPercentage",
  "dscr",
  "netWorth",
]);

/** Year-column bookkeeping. The year is shown on each financial row label. */
const INTERNAL_SUBMISSION_FIELD_KEYS = new Set([
  "financialReferenceYear",
  "financialYearColumnCount",
]);

/** Document uploads belong in the Documents tab, not Additional Details. */
function isApplicationDocumentField(
  fieldKey: string,
  label?: string | null,
) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[\s_-]+/g, "");

  const keyNorm = normalize(fieldKey);
  const labelNorm = normalize(label || "");

  return (
    keyNorm.includes("applicationdocument") ||
    labelNorm.includes("applicationdocument") ||
    keyNorm === "applicationdocumentcount" ||
    labelNorm.includes("applicationdocumentcount")
  );
}

/** Calculated statement rows. A $0 row is omitted when that year was left blank. */
function isComputedFinancialField(
  fieldKey: string,
  label?: string | null,
) {
  const key = fieldKey.trim();
  const labelText = (label || "").trim();

  return (
    /(?:^|_|[\s-])computed(?:_|$|[\s-]|$)/i.test(key) ||
    /computed$/i.test(key) ||
    /\bcomputed\b/i.test(labelText)
  );
}

/** Calculated $0 rows add noise when the borrower left that year blank. */
function isBlankDerivedFinancial(field: SubmissionDetailField) {
  const key = field.fieldKey || "";
  const bare = stripCoBorrowerPrefix(key);
  const derived =
    isComputedFinancialField(key, field.label) ||
    /^proFormaNoi_year_\d+$/i.test(bare);
  if (!derived) return false;
  const numeric = parseNumericValue(parseSubmissionFieldValue(field.value));
  return numeric === null || numeric === 0;
}

/** Blank currency lines are stored as 0. Keep a real zero only off these breakdown keys. */
function isUnenteredZeroLine(field: SubmissionDetailField) {
  const bare = stripCoBorrowerPrefix(field.fieldKey || "");
  const line =
    /^(asset_|liability_|financial_)/i.test(bare) ||
    /^proFormaNoi_year_\d+$/i.test(bare) ||
    /^(totalAssets|totalLiabilities|totalCashReserves|existingDebt|sreoTotalMarketValue|proFormaNoiAverage)$/i.test(
      bare,
    );
  if (!line) return false;
  return parseNumericValue(parseSubmissionFieldValue(field.value)) === 0;
}

/**
 * Bookkeeping keys only. Product answers (assets, liabilities, financial
 * statement rows, taxes, insurance, flood, rental) stay visible.
 */
function isInternalBackOfficeField(fieldKey: string) {
  const key = fieldKey.trim();
  if (!key) return true;

  const bareKey = stripCoBorrowerPrefix(key);
  if (INTERNAL_SUBMISSION_FIELD_KEYS.has(key)) return true;
  if (INTERNAL_SUBMISSION_FIELD_KEYS.has(bareKey)) return true;
  if (/^financialYear_/i.test(bareKey)) return true;
  if (/^col\d+$/i.test(bareKey)) return true;

  return false;
}

function shouldOmitSubmissionFieldFromDetails(
  fieldKey: string,
  label?: string | null,
) {
  return (
    isApplicationDocumentField(fieldKey, label) ||
    isInternalBackOfficeField(fieldKey)
  );
}

function resolveHeuristicSection(fieldKey: string) {
  if (fieldKey.startsWith("coBorrower_")) {
    const match = fieldKey.match(/^coBorrower_(\d+)_/);
    const index = match ? Number(match[1]) : 1;
    return {
      id: `co-borrower-${index}`,
      title: `Co-Borrower ${index}`,
      sortOrder: 200 + index,
    };
  }

  const bare = stripCoBorrowerPrefix(fieldKey);

  if (/^declaration_/i.test(bare)) {
    return { id: "declarations", title: "Declarations", sortOrder: 700 };
  }

  if (/^sreo_/i.test(bare) || bare === "sreoTotalMarketValue") {
    return {
      id: "real-estate-owned",
      title: "Real Estate Owned",
      sortOrder: 650,
    };
  }

  if (
    /^asset_/i.test(bare) ||
    bare === "totalAssets" ||
    bare === "totalCashReserves"
  ) {
    return { id: "assets", title: "Assets", sortOrder: 560 };
  }

  if (
    /^liability_/i.test(bare) ||
    bare === "totalLiabilities" ||
    bare === "existingDebt"
  ) {
    return { id: "liabilities", title: "Liabilities", sortOrder: 570 };
  }

  if (
    /^financial_/i.test(bare) ||
    /^proFormaNoi/i.test(bare) ||
    /^(annualPropertyTaxes|annualTaxes|annualInsurance|insurancePremium|hoaDues|floodZone|inFloodZone|rentalProperty|hasRentalIncome|monthlyRent|interimMonthsReported|dscrCalculationMethod|noiActual|noiProforma|grossRevenueActual|grossRevenueProforma|proFormaNoiAverage|projectSummary)$/i.test(
      bare,
    )
  ) {
    return {
      id: "financial-details",
      title: "Financial Details",
      sortOrder: 500,
    };
  }

  if (
    /property/i.test(fieldKey) ||
    /^(numberOfUnits|currentMarketValue|afterRepairValue|additionalCollateral|privateSale|vendorName|vendorPhone)$/i.test(
      bare,
    )
  ) {
    return {
      id: "property-details",
      title: "Property Details",
      sortOrder: 400,
    };
  }

  if (
    /entity|dba|legalName|entityType|business|formationDate|yearsInBusiness|naics|goodwill|inventory|equipment|ebitda/i.test(
      fieldKey,
    )
  ) {
    return {
      id: "entity-information",
      title: "Entity Information",
      sortOrder: 300,
    };
  }

  if (
    /noi|revenue|income|rent|tax|insurance|hoa|floodZone|financial|vacancy|cashFlow|grossIncome|override|asset|liabilit|expense|debt|equity|balance|inventoryValue|ebitda/i.test(
      fieldKey,
    )
  ) {
    return {
      id: "financial-details",
      title: "Financial Details",
      sortOrder: 500,
    };
  }

  if (
    /loan|amount|interest|term|purpose|recourse|ltv|ltc|dscr|product|rehab|construction|purchase|downPayment|useOfFunds|seller|budget|amortization|rateType|closing|exitStrategy/i.test(
      fieldKey,
    )
  ) {
    return {
      id: "loan-details",
      title: "Loan Details",
      sortOrder: 450,
    };
  }

  if (
    fieldKey.startsWith("borrower") ||
    /firstName|lastName|email|phone|dob|ssn|employer|creditScore|address|city|state|zip|country|mailing/i.test(
      fieldKey,
    )
  ) {
    return {
      id: "primary-borrower",
      title: "Primary Borrower",
      sortOrder: 100,
    };
  }

  return {
    id: "other-details",
    title: "Additional Details",
    sortOrder: 900,
  };
}

export function parseSubmissionFieldValue(value: string | unknown) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getSubmissionFieldLabel(field: SubmissionDetailField) {
  if (field.label) return field.label;
  if (field.fieldKey) return formatFieldLabel(field.fieldKey);
  return "Field";
}

export function formatSubmissionFieldValue(
  field: SubmissionDetailField,
  productLabels: Record<string, string> = PRODUCT_LABELS,
) {
  const fieldKey = field.fieldKey || "";
  const parsed = parseSubmissionFieldValue(field.value);

  if (fieldKey === "loanProductCode") {
    const code = String(parsed ?? "");
    return productLabels[code] || formatEnumLikeDisplayValue(code);
  }

  if (fieldKey === "loanCategory" || fieldKey === "recourse") {
    return formatEnumLikeDisplayValue(parsed);
  }

  return formatFieldDisplayValue(fieldKey, parsed);
}

export function groupSubmissionFieldsForDisplay(
  fields: SubmissionDetailField[] = [],
) {
  const signatureField =
    fields.find((field) => field.fieldKey === "borrowerSignature") || null;

  // Prefer canonical keys when aliases exist (e.g. businessIndustry over business_industry)
  const preferredByAlias = new Map<string, SubmissionDetailField>();
  for (const field of fields) {
    const fieldKey = field.fieldKey || "";
    if (!fieldKey) continue;
    const canonical = getFieldAliasCanonical(fieldKey);
    const existing = preferredByAlias.get(canonical);
    if (!existing) {
      preferredByAlias.set(canonical, field);
      continue;
    }
    if (fieldKey === canonical && existing.fieldKey !== canonical) {
      preferredByAlias.set(canonical, field);
    }
  }
  const preferredFieldIds = new Set(
    Array.from(preferredByAlias.values()).map(
      (field) => `${field.fieldKey}::${field.fieldId || ""}`,
    ),
  );

  const sectionMap = new Map<string, SubmissionFieldSection>();
  const seenAliasKeys = new Set<string>();
  const seenLabelValues = new Set<string>();
  const yearByColumn = new Map<string, string>();
  const enteredFinancialRows = new Set<string>();
  let hasFinancialNoi = false;
  let hasFinancialGrossRevenue = false;

  const scopeOf = (key: string) => key.match(/^(coBorrower_\d+_)/)?.[1] || "";

  for (const field of fields) {
    const fieldKey = field.fieldKey || "";
    const bare = stripCoBorrowerPrefix(fieldKey);
    const yearMatch = bare.match(/^financialYear_(col\d+)$/i);
    if (yearMatch) {
      const year = String(parseSubmissionFieldValue(field.value) ?? "").trim();
      if (year) {
        const index = Number(yearMatch[1].replace(/col/i, ""));
        yearByColumn.set(
          `${scopeOf(fieldKey)}${yearMatch[1].toLowerCase()}`,
          index === 0 ? `${year} (Interim)` : year,
        );
      }
    }
    if (/^financial_.+_col\d+$/i.test(bare) && !/_computed$/i.test(bare)) {
      enteredFinancialRows.add(`${scopeOf(fieldKey)}${bare.toLowerCase()}`);
    }
    if (/^financial_noi/i.test(bare)) hasFinancialNoi = true;
    if (/^financial_grossRevenue_/i.test(bare)) hasFinancialGrossRevenue = true;
  }

  fields.forEach((field) => {
    const fieldKey = field.fieldKey || "";
    if (!fieldKey || fieldKey === "borrowerSignature") return;
    if (METRIC_ONLY_FIELD_KEYS.has(fieldKey)) return;
    if (shouldOmitSubmissionFieldFromDetails(fieldKey, field.label)) return;
    if (fieldKey === "noiActual" && hasFinancialNoi) return;
    if (fieldKey === "grossRevenueActual" && hasFinancialGrossRevenue) return;

    const bare = stripCoBorrowerPrefix(fieldKey);
    const computedMatch = bare.match(/^(financial_.+_col\d+)_computed$/i);
    if (
      computedMatch &&
      enteredFinancialRows.has(
        `${scopeOf(fieldKey)}${computedMatch[1].toLowerCase()}`,
      )
    ) {
      return;
    }
    if (isBlankDerivedFinancial(field)) return;
    if (isUnenteredZeroLine(field)) return;

    const aliasKey = getFieldAliasCanonical(fieldKey);
    if (FIELD_ALIAS_TO_CANONICAL.has(fieldKey)) {
      if (!preferredFieldIds.has(`${field.fieldKey}::${field.fieldId || ""}`)) {
        return;
      }
      if (seenAliasKeys.has(aliasKey)) return;
      seenAliasKeys.add(aliasKey);
    }

    const columnMatch = bare.match(/_col(\d+)(?:_computed)?$/i);
    const yearLabel = columnMatch
      ? yearByColumn.get(`${scopeOf(fieldKey)}col${columnMatch[1]}`)
      : undefined;
    const generatedLabel = formatFieldLabel(fieldKey, yearLabel);
    const existingLabel = (field.label || "").trim();
    const structured =
      /^(asset_|liability_|financial_|declaration_|sreo_\d+_|proFormaNoi_)/i.test(
        bare,
      );
    const displayField: SubmissionDetailField =
      !existingLabel ||
      existingLabel === fieldKey ||
      structured ||
      Boolean(FIELD_LABELS[fieldKey] || FIELD_LABELS[bare])
        ? { ...field, label: generatedLabel }
        : field;

    const label = getSubmissionFieldLabel(displayField)
      .trim()
      .toLowerCase()
      .replace(/[\s/_-]+/g, "");
    const valueNorm = String(displayField.value ?? "")
      .trim()
      .toLowerCase();
    const labelValueKey = `${label}::${valueNorm}`;
    if (label && seenLabelValues.has(labelValueKey)) return;
    if (label) seenLabelValues.add(labelValueKey);

    const heuristic = resolveHeuristicSection(fieldKey);
    const useBuilderSection =
      Boolean(field.sectionName) && !fieldKey.startsWith("coBorrower_");

    const sectionId = useBuilderSection
      ? `builder:${field.sectionName}`
      : heuristic.id;
    const title = useBuilderSection ? field.sectionName! : heuristic.title;
    const sortOrder = useBuilderSection
      ? field.sectionSortOrder ?? 600
      : heuristic.sortOrder;

    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, {
        id: sectionId,
        title,
        sortOrder,
        fields: [],
      });
    }

    sectionMap.get(sectionId)!.fields.push(displayField);
  });

  const sections = Array.from(sectionMap.values())
    .map((section) => ({
      ...section,
      fields: [...section.fields].sort((left, right) => {
        const leftOrder = left.fieldSortOrder ?? 9999;
        const rightOrder = right.fieldSortOrder ?? 9999;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return getSubmissionFieldLabel(left).localeCompare(
          getSubmissionFieldLabel(right),
        );
      }),
    }))
    .filter((section) => section.fields.length > 0)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.title.localeCompare(right.title),
    );

  return { sections, signatureField };
}

export function getBorrowerDisplayNameFromFields(
  fields: SubmissionDetailField[] = [],
  fallbackName?: string | null,
) {
  const map = Object.fromEntries(
    fields
      .filter((field) => field.fieldKey)
      .map((field) => [field.fieldKey, parseSubmissionFieldValue(field.value)]),
  );

  const firstName = map.borrowerFirstName || map.first_name || "";
  const lastName = map.borrowerLastName || map.last_name || "";
  const combined = `${firstName} ${lastName}`.trim();

  return combined || fallbackName || "—";
}

export function getEntityTypeFromFields(fields: SubmissionDetailField[] = []) {
  const field = fields.find((item) => item.fieldKey === "entityType");
  if (!field) return "—";
  return formatSubmissionFieldValue(field);
}

function normalizeFieldValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function mapSubmissionDetailFields(
  rawFields: any[] = [],
): SubmissionDetailField[] {
  return rawFields.map((field) => ({
    fieldId: field.fieldId || field.id || null,
    fieldKey:
      field.fieldKey ??
      field.builderField?.fieldKey ??
      null,
    label: field.label ?? field.builderField?.label ?? null,
    type: field.type ?? field.builderField?.fieldType ?? null,
    value: normalizeFieldValue(field.value),
    sectionName: field.sectionName ?? field.builderField?.section?.name ?? null,
    sectionSortOrder:
      field.sectionSortOrder ?? field.builderField?.section?.sortOrder ?? null,
    fieldSortOrder: field.fieldSortOrder ?? field.builderField?.sortOrder ?? null,
  }));
}

export function getNumericFieldValue(
  fields: SubmissionDetailField[],
  fieldKey: string,
) {
  const field = fields.find((item) => item.fieldKey === fieldKey);
  if (!field) return 0;
  return parseNumericValue(parseSubmissionFieldValue(field.value)) || 0;
}


