/** US/Canada short date: month first, two-digit year (MM/DD/YY). */

export const US_DATE_PLACEHOLDER = "MM/DD/YY";

/** Flatpickr token string for the visible input. */
export const FLATPICKR_DISPLAY_FORMAT = "m/d/y";

/** Flatpickr/API storage format (ISO calendar date). */
export const FLATPICKR_VALUE_FORMAT = "Y-m-d";

const US_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "2-digit",
});

/**
 * Format a calendar date for display. ISO `YYYY-MM-DD` is converted without
 * UTC day-shift. Timestamps fall back to local MM/DD/YY.
 */
export function formatUsDate(value?: string | Date | number | null): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (iso && !trimmed.includes("T") && !trimmed.includes(" ")) {
      return `${iso[2]}/${iso[3]}/${iso[1].slice(-2)}`;
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return trimmed;
    return US_SHORT.format(date);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return US_SHORT.format(date);
}
