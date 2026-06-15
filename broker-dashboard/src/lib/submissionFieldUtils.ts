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
};

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
    if (!field?.fieldKey) return;
    map[field.fieldKey] = field.value;
  });

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

export function formatFieldLabel(fieldKey: string) {
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey];

  return fieldKey
    .replace(/^coBorrower_\d+_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatFieldDisplayValue(fieldKey: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "-";

  if (fieldKey === "floodZone") {
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "yes") return "Yes";
    if (normalized === "no") return "No";
  }

  if (
    /amount|price|value|rent|tax|premium|dues|assets|liabilities|networth|budget|revenue|noi/i.test(
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

  if (fieldKey === "loanProductCode") {
    return String(value).replace(/_/g, " ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
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
