import { PRODUCT_LABELS } from "./loanPipelineUtils";

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
  amountRequested: "Loan Amount Requested",
  interimMonthsReported: "Months Reported (Interim Year)",
  businessIndustry: "Business / Industry Type",
  business_industry: "Business / Industry Type",
  naicsCode: "Industry Code (NAICS)",
  naics: "Industry Code (NAICS)",
};

const METRIC_ONLY_FIELD_KEYS = new Set([
  "ltvPercentage",
  "ltcPercentage",
  "arvPercentage",
  "dscr",
  "netWorth",
  "totalAssets",
  "totalLiabilities",
]);

/** Shown in Application Overview / Key Metrics — avoid repeating in field sections. */
const OVERVIEW_ONLY_FIELD_KEYS = new Set([
  "loanProductCode",
  "amountRequested",
  "creditScore",
  "entityType",
  "existingDebt",
  "brokerPoints",
]);

/** Stored for calculations / duplicates — not shown in read-only details. */
const INTERNAL_SUBMISSION_FIELD_KEYS = new Set([
  "annualTaxes",
  "insurancePremium",
  "inFloodZone",
  "financialReferenceYear",
  "financialYearColumnCount",
  "sreoTotalMarketValue",
  "dscrCalculationMethod",
  "hasRentalIncome",
  "rentalProperty",
]);

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
  if (!raw) return "—";

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

function stripCoBorrowerPrefix(fieldKey: string) {
  return fieldKey.replace(/^coBorrower_\d+_/, "");
}

/**
 * Alias groups: first key is preferred when multiple equivalent fields exist.
 */
const FIELD_ALIAS_GROUPS: string[][] = [
  ["businessIndustry", "business_industry"],
  ["naicsCode", "naics", "naics_code"],
];

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

/** Derived/computed financial columns — hide from Financial Details display. */
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

/**
 * Internal storage keys, override columns, and granular breakdown rows
 * that should not appear on lender read-only View Details.
 */
function isInternalBackOfficeField(
  fieldKey: string,
  label?: string | null,
) {
  const key = fieldKey.trim();
  if (!key) return true;

  const bareKey = stripCoBorrowerPrefix(key);
  const labelText = (label || "").trim();

  if (INTERNAL_SUBMISSION_FIELD_KEYS.has(key)) return true;
  if (INTERNAL_SUBMISSION_FIELD_KEYS.has(bareKey)) return true;

  if (/^asset_/i.test(bareKey)) return true;
  if (/^liability_/i.test(bareKey)) return true;
  if (/^financial_/i.test(bareKey)) return true;
  if (/^financialYear_/i.test(bareKey)) return true;
  if (/^proFormaNoi_year_/i.test(bareKey)) return true;

  if (/override/i.test(key) || /override/i.test(bareKey)) return true;
  if (/\boverride\b/i.test(labelText)) return true;

  if (/_col\d+$/i.test(key)) return true;
  if (/^col\d+$/i.test(bareKey)) return true;

  return false;
}

function shouldOmitSubmissionFieldFromDetails(
  fieldKey: string,
  label?: string | null,
) {
  if (OVERVIEW_ONLY_FIELD_KEYS.has(fieldKey)) return true;
  return (
    isApplicationDocumentField(fieldKey, label) ||
    isComputedFinancialField(fieldKey, label) ||
    isInternalBackOfficeField(fieldKey, label)
  );
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

export function parseNumericValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseSubmissionFieldValue(value: string | unknown) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function formatFieldDisplayValue(fieldKey: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "—";

  const normalizedYesNo = String(value).trim().toLowerCase();
  if (normalizedYesNo === "yes") return "Yes";
  if (normalizedYesNo === "no") return "No";

  if (fieldKey === "floodZone") {
    if (normalizedYesNo === "yes") return "Yes";
    if (normalizedYesNo === "no") return "No";
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

  if (
    fieldKey === "loanProductCode" ||
    fieldKey === "loanCategory" ||
    fieldKey === "recourse"
  ) {
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

export function getLatestSubmission(submissions: any[] = []) {
  if (!submissions.length) return null;

  const active = submissions
    .filter((submission) => submission.status !== "SUPERSEDED")
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

  return active[0] || submissions[submissions.length - 1];
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

export function mapLenderSubmissionFields(
  rawFields: any[] = [],
): SubmissionDetailField[] {
  return rawFields.map((field) => ({
    fieldId: field.fieldId || field.id || null,
    fieldKey: field.fieldKey ?? field.builderField?.fieldKey ?? null,
    label: field.label ?? field.builderField?.label ?? null,
    type: field.type ?? field.builderField?.fieldType ?? null,
    value: normalizeFieldValue(field.value),
    sectionName: field.sectionName ?? field.builderField?.section?.name ?? null,
    sectionSortOrder:
      field.sectionSortOrder ?? field.builderField?.section?.sortOrder ?? null,
    fieldSortOrder: field.fieldSortOrder ?? field.builderField?.sortOrder ?? null,
  }));
}

export function getSubmissionFieldLabel(field: SubmissionDetailField) {
  if (field.label) return field.label;
  if (field.fieldKey) return formatFieldLabel(field.fieldKey);
  return "Field";
}

export function formatSubmissionFieldValue(field: SubmissionDetailField) {
  const fieldKey = field.fieldKey || "";
  const parsed = parseSubmissionFieldValue(field.value);

  if (fieldKey === "loanProductCode") {
    const code = String(parsed ?? "");
    return PRODUCT_LABELS[code] || formatEnumLikeDisplayValue(code);
  }

  if (fieldKey === "loanCategory" || fieldKey === "recourse") {
    return formatEnumLikeDisplayValue(parsed);
  }

  return formatFieldDisplayValue(fieldKey, parsed);
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

  if (/property/i.test(fieldKey)) {
    return {
      id: "property-details",
      title: "Property Details",
      sortOrder: 400,
    };
  }

  if (/entity|dba|legalName|entityType|business|formationDate|yearsInBusiness|naics|goodwill|inventory|equipment|ebitda/i.test(
      fieldKey,
    )
  ) {
    return {
      id: "entity-information",
      title: "Entity Information",
      sortOrder: 300,
    };
  }

  if (/noi|revenue|income|rent|tax|insurance|hoa|floodZone|financial|vacancy|cashFlow|grossIncome|override|expense|debt|equity|balance|inventoryValue|ebitda/i.test(fieldKey)) {
    return {
      id: "financial-details",
      title: "Financial Details",
      sortOrder: 500,
    };
  }

  if (/loan|amount|interest|term|purpose|recourse|ltv|ltc|dscr|product/i.test(fieldKey)) {
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

export function groupSubmissionFieldsForDisplay(
  fields: SubmissionDetailField[] = [],
) {
  const signatureField =
    fields.find((field) => field.fieldKey === "borrowerSignature") || null;

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

  fields.forEach((field) => {
    const fieldKey = field.fieldKey || "";
    if (!fieldKey || fieldKey === "borrowerSignature") return;
    if (METRIC_ONLY_FIELD_KEYS.has(fieldKey)) return;
    if (shouldOmitSubmissionFieldFromDetails(fieldKey, field.label)) return;

    const aliasKey = getFieldAliasCanonical(fieldKey);
    if (FIELD_ALIAS_TO_CANONICAL.has(fieldKey)) {
      if (!preferredFieldIds.has(`${field.fieldKey}::${field.fieldId || ""}`)) {
        return;
      }
      if (seenAliasKeys.has(aliasKey)) return;
      seenAliasKeys.add(aliasKey);
    }

    const label = getSubmissionFieldLabel(field)
      .trim()
      .toLowerCase()
      .replace(/[\s/_-]+/g, "");
    const valueNorm = String(field.value ?? "")
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

    sectionMap.get(sectionId)!.fields.push(field);
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

export function getNumericFieldValue(
  fields: SubmissionDetailField[],
  fieldKey: string,
) {
  const field = fields.find((item) => item.fieldKey === fieldKey);
  if (!field) return 0;
  return parseNumericValue(parseSubmissionFieldValue(field.value)) || 0;
}
