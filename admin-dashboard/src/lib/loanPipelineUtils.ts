const PLACEHOLDER_NAMES = new Set([
  "Applicant",
  "Individual Applicant",
  "Unknown",
  "Client",
  "Customer",
  "N/A",
]);

type SubmissionField = {
  fieldKey?: string;
  builderField?: { fieldKey?: string };
  value?: unknown;
};

function isPlaceholderName(name?: string | null) {
  if (!name) return true;
  const trimmed = String(name).trim();
  return !trimmed || PLACEHOLDER_NAMES.has(trimmed);
}

function buildFullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim();
}

export function getSubmissionFields(item: {
  submissions?: { fields?: SubmissionField[] }[];
}): SubmissionField[] {
  return item.submissions?.[0]?.fields || [];
}

export function getSubmissionFieldValue(
  fields: SubmissionField[],
  ...keys: string[]
): string | null {
  for (const field of fields) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!key || !keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      const nested = (raw as { value?: unknown }).value;
      if (typeof nested === "string" || typeof nested === "number") {
        return String(nested).trim();
      }
    }
    return String(raw).trim();
  }
  return null;
}

export function resolveBorrowerName(item: {
  borrowerName?: string;
  client?: {
    legalName?: string;
    contacts?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isPrimary?: boolean;
    }[];
  };
  submissions?: { fields?: SubmissionField[] }[];
}): string {
  if (item.borrowerName && !isPlaceholderName(item.borrowerName)) {
    return item.borrowerName;
  }

  const fields = getSubmissionFields(item);
  const contacts = item.client?.contacts || [];
  const primary =
    contacts.find((c) => c.isPrimary) || contacts[0];

  const fromContact = buildFullName(primary?.firstName, primary?.lastName);
  if (!isPlaceholderName(fromContact)) return fromContact;

  for (const contact of contacts) {
    const name = buildFullName(contact.firstName, contact.lastName);
    if (!isPlaceholderName(name)) return name;
  }

  const fromFields = buildFullName(
    getSubmissionFieldValue(
      fields,
      "borrowerFirstName",
      "firstName",
      "first_name",
    ),
    getSubmissionFieldValue(fields, "borrowerLastName", "lastName", "last_name"),
  );
  if (!isPlaceholderName(fromFields)) return fromFields;

  const singleName = getSubmissionFieldValue(
    fields,
    "borrowerName",
    "applicantName",
    "fullName",
    "name",
    "legalName",
    "businessName",
  );
  if (!isPlaceholderName(singleName)) return singleName!;

  const legalName = item.client?.legalName?.trim();
  if (!isPlaceholderName(legalName)) return legalName!;

  const email = primary?.email || contacts.find((c) => c.email)?.email;
  if (email?.includes("@")) {
    const local = email
      .split("@")[0]
      .replace(/\d+/g, " ")
      .replace(/[._-]+/g, " ")
      .trim();
    if (local.length >= 2) {
      const formatted = local
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      if (!isPlaceholderName(formatted)) return formatted;
    }
  }

  return "Client";
}

export function resolveEntityType(item: {
  entityType?: string;
  client?: { entityType?: string };
  submissions?: { fields?: SubmissionField[] }[];
}): string {
  const fields = getSubmissionFields(item);
  const submissionEntityType = getSubmissionFieldValue(
    fields,
    "entityType",
    "borrowerEntityType",
    "businessEntityType",
  );

  if (submissionEntityType && submissionEntityType !== "-") {
    return submissionEntityType;
  }

  if (item.entityType && item.entityType !== "-") return item.entityType;

  const clientType = item.client?.entityType;
  if (clientType) return clientType;

  return "-";
}

function isGenericIndividualEntityType(value?: string | null) {
  if (!value) return true;
  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, "_");
  return (
    normalized === "INDIVIDUAL" ||
    normalized === "SOLE_PROPRIETOR" ||
    normalized === "SOLE_PROPRIETORSHIP"
  );
}

export function resolveEntityLabel(item: {
  entityLabel?: string | null;
  client?: {
    legalName?: string;
    entityType?: string;
    contacts?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isPrimary?: boolean;
    }[];
  };
  submissions?: { fields?: SubmissionField[] }[];
}): string | null {
  if (item.entityLabel?.trim()) return item.entityLabel.trim();

  const fields = getSubmissionFields(item);
  const entityLegalName = getSubmissionFieldValue(
    fields,
    "entityLegalName",
    "businessName",
    "businessLegalName",
    "companyName",
    "dba",
    "doingBusinessAs",
  );

  if (!isPlaceholderName(entityLegalName)) return entityLegalName;

  const displayName = resolveBorrowerName(item);
  const clientLegalName = item.client?.legalName?.trim();
  if (
    clientLegalName &&
    !isPlaceholderName(clientLegalName) &&
    clientLegalName !== displayName
  ) {
    return clientLegalName;
  }

  const submissionEntityType = getSubmissionFieldValue(
    fields,
    "entityType",
    "borrowerEntityType",
    "businessEntityType",
  );

  if (submissionEntityType && !isGenericIndividualEntityType(submissionEntityType)) {
    return formatEntityTypeLabel(submissionEntityType);
  }

  const clientEntityType = item.client?.entityType;
  if (clientEntityType && !isGenericIndividualEntityType(clientEntityType)) {
    return formatEntityTypeLabel(clientEntityType);
  }

  return null;
}

export function resolveLoanAmount(item: {
  amountRequested?: number | string | null;
  submissions?: { fields?: SubmissionField[] }[];
}): number | null {
  if (item.amountRequested != null && item.amountRequested !== "") {
    const n = Number(item.amountRequested);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const fields = getSubmissionFields(item);
  const raw = getSubmissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (!raw) return null;
  const n = Number(String(raw).replace(/[,$]/g, ""));
  return Number.isNaN(n) ? null : n;
}

export function resolvePurpose(item: {
  purpose?: string;
  submissions?: { fields?: SubmissionField[] }[];
}): string | null {
  if (item.purpose) return item.purpose;

  const fields = getSubmissionFields(item);
  return getSubmissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds");
}

export function resolveTermLabel(item: {
  termMonthsRequested?: number | string | null;
  minTermMonths?: number | null;
  maxTermMonths?: number | null;
  submissions?: { fields?: SubmissionField[] }[];
}): string | null {
  if (item.termMonthsRequested) return String(item.termMonthsRequested);

  const fields = getSubmissionFields(item);
  const min =
    item.minTermMonths ||
    Number(getSubmissionFieldValue(fields, "minTermMonths")) ||
    null;
  const max =
    item.maxTermMonths ||
    Number(getSubmissionFieldValue(fields, "maxTermMonths")) ||
    null;

  const termYears = Number(getSubmissionFieldValue(fields, "requested_term_years"));
  const resolvedMax = max || (termYears ? termYears * 12 : null);

  if (min && resolvedMax) return `${min}–${resolvedMax} months`;
  if (resolvedMax) return `${resolvedMax} months`;
  if (min) return `${min} months`;

  const term = getSubmissionFieldValue(fields, "termMonths", "loanTerm");
  return term || null;
}

export function parseFieldValue(val: unknown): string {
  if (val == null || val === "") return "-";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return "-";
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          if ("value" in parsed) return String((parsed as { value: unknown }).value);
          if ("label" in parsed) return String((parsed as { label: unknown }).label);
        }
        return JSON.stringify(parsed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.value != null) return String(obj.value);
    if (obj.label != null) return String(obj.label);
    return JSON.stringify(val);
  }

  return String(val);
}

export function formatEntityTypeLabel(value?: string | null) {
  if (!value || value === "-") return "—";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
