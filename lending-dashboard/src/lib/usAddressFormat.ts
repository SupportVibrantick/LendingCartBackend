/** US phone: 999-999-9999 */
export function formatUSPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidUSPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10;
}

/** US ZIP: 12345 or 12345-6789 */
export function formatUSZip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidUSZip(value: string) {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

export const US_STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

export function normalizeUSState(value: string) {
  return value.trim().toUpperCase().slice(0, 2);
}

export function isValidUSState(value: string) {
  const normalized = normalizeUSState(value);
  if (!normalized) return true;
  return US_STATE_OPTIONS.includes(normalized as (typeof US_STATE_OPTIONS)[number]);
}
