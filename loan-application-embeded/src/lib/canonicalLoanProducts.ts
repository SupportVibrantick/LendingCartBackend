/** Residential variant → canonical code (shared with lender catalog). */
export const CANONICAL_LOAN_PRODUCT_CODE: Record<string, string> = {
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE_LOAN",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION_LOAN",
};

/** Normalize Bridge / Construction residential codes to the shared CRE code. */
export function resolveCanonicalLoanProductCode(code: string): string {
  const normalized = String(code || "").trim();
  if (!normalized) return "";
  return CANONICAL_LOAN_PRODUCT_CODE[normalized] || normalized;
}
