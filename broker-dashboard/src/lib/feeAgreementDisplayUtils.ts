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

export function displayBrokerBrandName(
  brandName: unknown,
  company: unknown,
): string {
  if (!isEmptyAgreementValue(brandName)) return String(brandName).trim();
  if (!isEmptyAgreementValue(company)) return String(company).trim();
  return "____________";
}

export function resolveAgreementDate(data: {
  signedAt?: string | null;
  createdAt?: string | null;
}): string {
  if (data.signedAt) {
    return new Date(data.signedAt).toLocaleDateString();
  }
  if (data.createdAt) {
    return new Date(data.createdAt).toLocaleDateString();
  }
  return new Date().toLocaleDateString();
}

export function resolveIssuerPropertyAddress(
  clientAddress: unknown,
  subjectAddress: unknown,
  fallback = "____________",
): string {
  if (!isEmptyAgreementValue(clientAddress)) {
    return String(clientAddress).trim();
  }
  if (!isEmptyAgreementValue(subjectAddress)) {
    return String(subjectAddress).trim();
  }
  return fallback;
}

export function formatIssuerPartyNameForAgreement(
  clientName: unknown,
  clientEntityName: unknown,
): string {
  const name = isEmptyAgreementValue(clientName)
    ? "____________"
    : String(clientName).trim();

  if (
    isEmptyAgreementValue(clientEntityName) ||
    isPlaceholderAgreementName(clientEntityName)
  ) {
    return name;
  }

  return `${name} / ${String(clientEntityName).trim()}`;
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

export const FEE_AGREEMENT_LIMITS = {
  brokerPointsMax: 100,
  upfrontFeeMax: 99_999_999.99,
  exclusivityMonthsMax: 360,
};

export function validateFeeAgreementForm(form: {
  brokerPoints?: unknown;
  upfrontFee?: unknown;
  exclusivityMonths?: unknown;
}): {
  brokerPoints: string;
  upfrontFee: string;
  exclusivityMonths: string;
} {
  const errors = {
    brokerPoints: "",
    upfrontFee: "",
    exclusivityMonths: "",
  };

  if (!form.brokerPoints?.toString().trim()) {
    errors.brokerPoints = "Broker fee is required";
  } else {
    const brokerPoints = Number(form.brokerPoints);
    if (!Number.isFinite(brokerPoints)) {
      errors.brokerPoints = "Enter a valid broker fee percentage";
    } else if (brokerPoints < 0 || brokerPoints > FEE_AGREEMENT_LIMITS.brokerPointsMax) {
      errors.brokerPoints = `Broker fee must be between 0 and ${FEE_AGREEMENT_LIMITS.brokerPointsMax}%`;
    }
  }

  if (!form.upfrontFee?.toString().trim()) {
    errors.upfrontFee = "Upfront fee is required";
  } else {
    const upfrontFee = Number(form.upfrontFee);
    if (!Number.isFinite(upfrontFee)) {
      errors.upfrontFee = "Enter a valid upfront fee amount";
    } else if (upfrontFee < 0 || upfrontFee > FEE_AGREEMENT_LIMITS.upfrontFeeMax) {
      errors.upfrontFee = "Upfront fee is too large";
    }
  }

  if (!form.exclusivityMonths?.toString().trim()) {
    errors.exclusivityMonths = "Exclusivity months is required";
  } else {
    const exclusivityMonths = Number(form.exclusivityMonths);
    if (!Number.isFinite(exclusivityMonths) || !Number.isInteger(exclusivityMonths)) {
      errors.exclusivityMonths = "Enter a whole number of months";
    } else if (
      exclusivityMonths <= 0 ||
      exclusivityMonths > FEE_AGREEMENT_LIMITS.exclusivityMonthsMax
    ) {
      errors.exclusivityMonths = `Exclusivity must be between 1 and ${FEE_AGREEMENT_LIMITS.exclusivityMonthsMax} months`;
    }
  }

  return errors;
}

function isFeeTermConfigured(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

export function isFeeAgreementSigned(data: {
  status?: string | null;
  clientSignature?: string | null;
  signedAt?: string | null;
}): boolean {
  if (String(data.status || "").toUpperCase() === "SIGNED") {
    return true;
  }

  return Boolean(data.clientSignature && data.signedAt);
}
