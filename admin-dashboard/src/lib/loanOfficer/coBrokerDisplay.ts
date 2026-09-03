import { US_STATES } from "./loanOfficerShared";

const STATE_NAME_BY_CODE = Object.fromEntries(
  US_STATES.map((state) => [state.code, state.name]),
);

export function formatStateCodes(codes?: string[] | null) {
  if (!codes?.length) return "—";
  return codes
    .map((code) => STATE_NAME_BY_CODE[code] || code)
    .join(", ");
}

export function formatList(values?: string[] | null, fallback = "—") {
  if (!values?.length) return fallback;
  return values
    .map((value) => value.replace(/_/g, " "))
    .join(", ");
}

export function formatYesNo(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

export function formatDisplayValue(value?: string | number | null) {
  if (value == null || value === "") return "—";
  return String(value);
}

export function formatFileUrl(baseUrl: string, path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
