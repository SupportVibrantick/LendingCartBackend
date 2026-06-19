const EMPTY_MARKERS = new Set(["n/a", "na", "—", "-", "null", "undefined"]);
const PLACEHOLDER_NAMES = new Set([
  "Applicant",
  "Individual Applicant",
  "Unknown",
  "Client",
  "Customer",
  "N/A",
]);

export function isPlaceholderAgreementName(value: unknown): boolean {
  if (isEmptyAgreementValue(value)) return true;
  return PLACEHOLDER_NAMES.has(String(value).trim());
}

export function formatIssuerPartyName(
  clientName: unknown,
  clientEntityName: unknown,
): string {
  const name = displayAgreementText(clientName);
  if (
    isEmptyAgreementValue(clientEntityName) ||
    isPlaceholderAgreementName(clientEntityName)
  ) {
    return name;
  }
  return `${name} (${displayAgreementText(clientEntityName)})`;
}

export function displayClientEntityLabel(
  clientEntityName: unknown,
  entityType?: unknown,
): string {
  if (
    !isEmptyAgreementValue(clientEntityName) &&
    !isPlaceholderAgreementName(clientEntityName)
  ) {
    return displayAgreementText(clientEntityName);
  }

  if (!isEmptyAgreementValue(entityType)) {
    const normalized = String(entityType).trim().toUpperCase().replace(/\s+/g, "_");
    if (
      normalized === "INDIVIDUAL" ||
      normalized === "SOLE_PROPRIETOR" ||
      normalized === "SOLE_PROPRIETORSHIP"
    ) {
      return "Individual";
    }

    return String(entityType)
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "Individual";
}

export function isEmptyAgreementValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  return EMPTY_MARKERS.has(text.toLowerCase());
}

export function displayAgreementText(
  value: unknown,
  fallback = "Not provided",
): string {
  return isEmptyAgreementValue(value) ? fallback : String(value).trim();
}

export function displayBrokerName(name: unknown, company: unknown): string {
  if (!isEmptyAgreementValue(name)) return String(name).trim();
  if (!isEmptyAgreementValue(company)) return String(company).trim();
  return "Broker Representative";
}

export function displayFeePercent(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "To be determined";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "To be determined";
  return `${numeric}%`;
}

export function displayFeeAmount(
  value: unknown,
  currencySymbol = "$",
): string {
  if (value === null || value === undefined || value === "") {
    return "To be determined";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "To be determined";
  return `${currencySymbol}${numeric.toLocaleString("en-US")}`;
}

export function displayExclusivityMonths(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "To be determined";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "To be determined";
  }

  return `${numeric} month${numeric === 1 ? "" : "s"}`;
}

export function displayGoverningLaw(state: unknown, county: unknown): string {
  const stateText = isEmptyAgreementValue(state) ? "" : String(state).trim();
  const countyText = isEmptyAgreementValue(county) ? "" : String(county).trim();

  if (!stateText && !countyText) {
    return "Governing law and venue will be specified when the broker finalizes this agreement.";
  }

  if (stateText && countyText) {
    return `This agreement shall be governed by the laws of the State of ${stateText}. Any dispute shall be resolved in Supreme Court, ${countyText} County, State of ${stateText}.`;
  }

  if (stateText) {
    return `This agreement shall be governed by the laws of the State of ${stateText}.`;
  }

  return `Any dispute shall be resolved in Supreme Court, ${countyText} County.`;
}

export function hasFeeTerms(data: {
  brokerPoints?: unknown;
  upfrontFee?: unknown;
  exclusivityMonths?: unknown;
}): boolean {
  return canClientSignFeeAgreement(data);
}

export function canClientSignFeeAgreement(data: {
  brokerPoints?: unknown;
  upfrontFee?: unknown;
  exclusivityMonths?: unknown;
}): boolean {
  if (!isFeeTermConfigured(data.brokerPoints)) return false;
  if (!isFeeTermConfigured(data.upfrontFee)) return false;
  if (!isFeeTermConfigured(data.exclusivityMonths)) return false;

  const exclusivity = Number(data.exclusivityMonths);
  return Number.isFinite(exclusivity) && exclusivity > 0;
}

function isFeeTermConfigured(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}
