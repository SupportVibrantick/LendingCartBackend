/**
 * Metadata for hardcoded loan-application form fields that are submitted
 * without a builder fieldId. Used when enriching submission field responses.
 */

const STATIC_SUBMISSION_FIELDS = {
  borrowerFirstName: { label: "Borrower First Name", fieldType: "TEXT" },
  borrowerLastName: { label: "Borrower Last Name", fieldType: "TEXT" },
  companyName: { label: "Company Name", fieldType: "TEXT" },
  email: { label: "Email", fieldType: "EMAIL" },
  phone: { label: "Phone", fieldType: "TEXT" },
  creditScore: { label: "Credit Score", fieldType: "NUMBER" },
  borrowerCity: { label: "Borrower City", fieldType: "TEXT" },
  borrowerState: { label: "Borrower State", fieldType: "TEXT" },
  borrowerCountry: { label: "Borrower Country", fieldType: "TEXT" },
  dob: { label: "Date of Birth", fieldType: "DATE" },
  ssn: { label: "SSN", fieldType: "TEXT" },
  address: { label: "Address", fieldType: "TEXT" },
  mailingAddress: { label: "Mailing Address", fieldType: "TEXT" },
  employer: { label: "Employer", fieldType: "TEXT" },

  loanProductCode: { label: "Loan Product Code", fieldType: "TEXT" },
  amountRequested: { label: "Loan Amount Requested", fieldType: "NUMBER" },
  interestRate: { label: "Interest Rate", fieldType: "NUMBER" },
  purpose: { label: "Purpose of Loan", fieldType: "SELECT" },
  propertyType: { label: "Property Type", fieldType: "SELECT" },
  subPropertyType: { label: "Sub Property Type", fieldType: "SELECT" },
  recourse: { label: "Recourse", fieldType: "SELECT" },
  sellerFinancing: { label: "Seller Financing", fieldType: "TEXT" },
  sellerNoteAmount: { label: "Seller Note Amount", fieldType: "NUMBER" },
  estimatedClosingDate: { label: "Estimated Closing Date", fieldType: "DATE" },
  rateType: { label: "Rate Type", fieldType: "SELECT" },
  brokerPoints: { label: "Broker Points (%)", fieldType: "NUMBER" },
  amortization: { label: "Amortization (Years)", fieldType: "NUMBER" },

  workingWithMortgageBroker: {
    label: "Working With Mortgage Broker",
    fieldType: "SELECT",
    options: ["yes", "no"],
  },
  referringBrokerEmail: {
    label: "Referring Broker Email",
    fieldType: "EMAIL",
  },
  referringBrokerFirstName: {
    label: "Referring Broker First Name",
    fieldType: "TEXT",
  },
  referringBrokerLastName: {
    label: "Referring Broker Last Name",
    fieldType: "TEXT",
  },
  referringBrokerCompanyName: {
    label: "Referring Broker Company Name",
    fieldType: "TEXT",
  },
  referringBrokerPhone: {
    label: "Referring Broker Phone",
    fieldType: "TEXT",
  },

  propertyAddress: { label: "Property Address", fieldType: "TEXT" },
  propertyCity: { label: "Property City", fieldType: "TEXT" },
  propertyState: { label: "Property State", fieldType: "TEXT" },
  propertyZip: { label: "Property Zip", fieldType: "TEXT" },
  propertyCountry: { label: "Property Country", fieldType: "TEXT" },

  loanTerm: { label: "Loan Term (Months)", fieldType: "NUMBER" },
  noiActual: { label: "NOI Actual", fieldType: "NUMBER" },

  entityLegalName: { label: "Entity Legal Name", fieldType: "TEXT" },
  entityType: { label: "Entity Type", fieldType: "SELECT" },
  dba: { label: "DBA", fieldType: "TEXT" },
  formationDate: { label: "Formation Date", fieldType: "DATE" },
  yearsInBusiness: { label: "Years in Business", fieldType: "NUMBER" },
  ebitda: { label: "EBITDA with NOI", fieldType: "NUMBER" },
  naicsCode: { label: "Industry Code (NAICS)", fieldType: "TEXT" },
  naics: { label: "Industry Code (NAICS)", fieldType: "TEXT" },
  goodwillAmount: { label: "Goodwill Amount", fieldType: "NUMBER" },
  inventoryIncluded: { label: "Inventory Included", fieldType: "TEXT" },
  equipmentIncluded: { label: "Equipment Included", fieldType: "TEXT" },
  inventoryValue: { label: "Inventory Value", fieldType: "NUMBER" },
  equipmentValue: { label: "Equipment Value", fieldType: "NUMBER" },
  businessIndustry: { label: "Business / Industry Type", fieldType: "TEXT" },
  business_industry: { label: "Business / Industry Type", fieldType: "TEXT" },
  numberOfUnits: { label: "Number of Units", fieldType: "NUMBER" },
  constructionBudget: { label: "Construction Budget", fieldType: "NUMBER" },
  rehabCost: { label: "Rehab Cost", fieldType: "NUMBER" },
  entityOwnershipPercent: { label: "Entity Ownership %", fieldType: "NUMBER" },

  currentMarketValue: { label: "Current Market Value", fieldType: "NUMBER" },
  afterRepairValue: { label: "After Repair Value", fieldType: "NUMBER" },
  purchasePrice: { label: "Purchase Price", fieldType: "NUMBER" },
  purchaseDate: { label: "Purchase Date", fieldType: "DATE" },
  totalAssets: { label: "Total Assets", fieldType: "NUMBER" },
  totalLiabilities: { label: "Total Liabilities", fieldType: "NUMBER" },

  monthlyRent: { label: "Monthly Rent", fieldType: "NUMBER" },
  grossRevenueActual: { label: "Gross Revenue (Actual)", fieldType: "NUMBER" },
  grossRevenueProforma: {
    label: "Gross Revenue (Proforma)",
    fieldType: "NUMBER",
  },
  noiProforma: { label: "NOI Proforma", fieldType: "NUMBER" },
  annualTaxes: { label: "Annual Taxes", fieldType: "NUMBER" },
  floodZone: { label: "Flood Zone", fieldType: "TEXT" },
  insurancePremium: { label: "Insurance Premium", fieldType: "NUMBER" },
  hoaDues: { label: "HOA Dues", fieldType: "NUMBER" },

  ltvPercentage: { label: "LTV %", fieldType: "NUMBER" },
  ltcPercentage: { label: "LTC %", fieldType: "NUMBER" },
  arvPercentage: { label: "ARV %", fieldType: "NUMBER" },
  dscr: { label: "DSCR", fieldType: "NUMBER" },
  netWorth: { label: "Net Worth", fieldType: "NUMBER" },

  // Legacy / alternate keys
  first_name: { label: "First Name", fieldType: "TEXT" },
  last_name: { label: "Last Name", fieldType: "TEXT" },
  loan_amount: { label: "Loan Amount", fieldType: "NUMBER" },
  credit_score: { label: "Credit Score", fieldType: "NUMBER" },
};

const CO_BORROWER_NUMBER_FIELDS = new Set([
  "creditScore",
  "currentMarketValue",
  "purchasePrice",
  "interestRate",
  "noi",
  "totalAssets",
  "totalLiabilities",
  "netWorth",
  "ltv",
  "ltc",
  "dscr",
]);

const CO_BORROWER_FIELD_LABELS = {
  name: "Name",
  entityName: "Entity Name",
  phone: "Phone",
  email: "Email",
  employer: "Employer",
  dob: "Date of Birth",
  ssn: "SSN",
  creditScore: "Credit Score",
  address: "Address",
  city: "City",
  state: "State",
  mailingAddress: "Mailing Address",
  currentMarketValue: "Current Market Value",
  purchasePrice: "Purchase Price",
  interestRate: "Interest Rate",
  noi: "NOI",
  totalAssets: "Total Assets",
  totalLiabilities: "Total Liabilities",
  netWorth: "Net Worth",
  ltv: "LTV",
  ltc: "LTC",
  dscr: "DSCR",
};

function humanizeFieldKey(fieldKey) {
  return fieldKey
    .replace(/^coBorrower_\d+_/, "coBorrower_")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveSubmissionFieldMeta(fieldKey) {
  if (!fieldKey) return null;

  const direct = STATIC_SUBMISSION_FIELDS[fieldKey];
  if (direct) {
    return {
      label: direct.label,
      fieldType: direct.fieldType,
      options: direct.options ?? null,
    };
  }

  const financialMatch = fieldKey.match(/^financial_(.+?)_(col\d+)$/);
  if (financialMatch) {
    const metric = humanizeFieldKey(financialMatch[1]);
    const column = financialMatch[2].replace("col", "Year ");
    return {
      label: `${metric} (${column})`,
      fieldType: "NUMBER",
      options: null,
    };
  }

  if (fieldKey.startsWith("financialYear_")) {
    return {
      label: `Financial Year ${fieldKey.replace("financialYear_", "")}`,
      fieldType: "NUMBER",
      options: null,
    };
  }

  if (fieldKey === "financialReferenceYear") {
    return {
      label: "Financial Reference Year",
      fieldType: "NUMBER",
      options: null,
    };
  }

  const coBorrowerMatch = fieldKey.match(/^coBorrower_(\d+)_(.+)$/);
  if (coBorrowerMatch) {
    const index = coBorrowerMatch[1];
    const suffix = coBorrowerMatch[2];
    const suffixLabel = CO_BORROWER_FIELD_LABELS[suffix] || humanizeFieldKey(suffix);

    return {
      label: `Co-Borrower ${index} ${suffixLabel}`,
      fieldType: CO_BORROWER_NUMBER_FIELDS.has(suffix) ? "NUMBER" : "TEXT",
      options: null,
    };
  }

  return {
    label: humanizeFieldKey(fieldKey),
    fieldType: "TEXT",
    options: null,
  };
}

function normalizeSubmissionFieldValue(value) {
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

function mapSubmissionFieldResponse(field) {
  const fieldKey = field.builderField?.fieldKey ?? field.fieldKey;
  const fallback = resolveSubmissionFieldMeta(fieldKey);

  return {
    fieldId: field.fieldId,
    fieldKey,
    label: field.builderField?.label ?? fallback?.label ?? "Deleted Field",
    type: field.builderField?.fieldType ?? fallback?.fieldType ?? null,
    options: field.builderField?.options ?? fallback?.options ?? null,
    value: normalizeSubmissionFieldValue(field.value),
    source: field.source,
    sectionName: field.builderField?.section?.name ?? null,
    sectionSortOrder: field.builderField?.section?.sortOrder ?? null,
    fieldSortOrder: field.builderField?.sortOrder ?? null,
  };
}

function buildSubmissionFieldsPayload(fields, fieldIdByKey) {
  return fields.map((field) => {
    const fieldId =
      field.fieldId || (field.fieldKey && fieldIdByKey.get(field.fieldKey)) || null;

    return {
      fieldId,
      fieldKey: field.fieldKey || null,
      value: field.value ?? null,
      source: fieldId ? "DYNAMIC" : "STATIC",
    };
  });
}

async function loadProductFieldIdMap(prisma, applicationProductId) {
  if (!applicationProductId) {
    return new Map();
  }

  const builderFields = await prisma.brokerApplicationProductField.findMany({
    where: { applicationProductId },
    select: { id: true, fieldKey: true },
  });

  return new Map(builderFields.map((field) => [field.fieldKey, field.id]));
}

module.exports = {
  STATIC_SUBMISSION_FIELDS,
  resolveSubmissionFieldMeta,
  mapSubmissionFieldResponse,
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
};
