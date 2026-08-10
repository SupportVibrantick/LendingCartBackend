// Small formatter and number-conversion helpers used across the
// LoanApplication form. These are pure functions; no state.

/** US ZIP regex (12345 or 12345-6789). */
export const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

/** Email regex used for field validation. */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

/** US phone number regex (XXX-XXX-XXXX). */
export const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

/** SSN regex (XXX-XX-XXXX). */
export const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;

/**
 * Format a string of digits as a US phone number (XXX-XXX-XXXX).
 * Truncates to 10 digits and re-formats on every keystroke.
 */
export const formatUSPhone = (value?: string | null) => {
  // Remove non-digits
  const cleaned = (value ?? "").replace(/\D/g, "").slice(0, 10);

  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

  if (!match) return cleaned;

  let formatted = "";

  if (match[1]) formatted += match[1];
  if (match[2]) formatted += "-" + match[2];
  if (match[3]) formatted += "-" + match[3];

  return formatted;
};

/**
 * Format a string of digits as a US SSN (XXX-XX-XXXX).
 * Truncates to 9 digits and re-formats on every keystroke.
 */
export const formatSSN = (value?: string | null) => {
  // Remove non-digits
  const cleaned = (value ?? "").replace(/\D/g, "").slice(0, 9);

  const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);

  if (!match) return cleaned;

  let formatted = "";

  if (match[1]) formatted += match[1];
  if (match[2]) formatted += "-" + match[2];
  if (match[3]) formatted += "-" + match[3];

  return formatted;
};

/**
 * Format a numeric string as a comma-separated currency-style value
 * (e.g. "1234567" -> "1,234,567"). Returns "" for empty input.
 */
export const formatCurrency = (value?: string | null) => {
  // Remove everything except digits
  const cleaned = (value ?? "").replace(/\D/g, "");

  if (!cleaned) return "";

  return Number(cleaned).toLocaleString("en-US");
};

/**
 * Convert a formatted currency/string number into a JS number.
 * Returns 0 for empty/invalid input.
 */
export const toNumber = (value?: string | null) => {
  const cleaned = (value ?? "").replace(/,/g, "");
  return parseFloat(cleaned) || 0;
};

/** Title-case a phrase (e.g. "ground-up construction" -> "Ground-Up Construction"). */
export const toTitleCase = (text: string) => {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Compute the standard amortized monthly payment for a loan.
 * Returns 0 if the inputs are invalid (missing amount, term, etc.).
 */
export const calculateMonthlyPayment = (
  loanAmount: number,
  interestRate: number,
  termMonths: number,
) => {
  if (!loanAmount || !termMonths || termMonths <= 0) return 0;
  if (interestRate < 0) return 0;

  const monthlyRate = interestRate / 100 / 12;

  if (monthlyRate === 0) {
    return loanAmount / termMonths;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
};

/**
 * Compute the interest-only monthly payment for a loan. The borrower
 * pays only the accrued interest each month; principal is not reduced.
 * Returns 0 when the inputs are invalid.
 */
export const calculateInterestOnlyMonthlyPayment = (
  loanAmount: number,
  interestRate: number,
) => {
  if (!loanAmount || interestRate < 0) return 0;
  return (loanAmount * (interestRate / 100)) / 12;
};
