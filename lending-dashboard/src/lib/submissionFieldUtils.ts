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
};

const METRIC_ONLY_FIELD_KEYS = new Set([
  "ltvPercentage",
  "ltcPercentage",
  "arvPercentage",
  "dscr",
  "netWorth",
]);

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
    const code = String(value);
    return PRODUCT_LABELS[code] || code.replace(/_/g, " ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
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

  if (/noi|revenue|income|rent|tax|insurance|hoa|assets|liabilities|floodZone|financial/i.test(fieldKey)) {
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

  const sectionMap = new Map<string, SubmissionFieldSection>();

  fields.forEach((field) => {
    const fieldKey = field.fieldKey || "";
    if (!fieldKey || fieldKey === "borrowerSignature") return;
    if (METRIC_ONLY_FIELD_KEYS.has(fieldKey)) return;

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
