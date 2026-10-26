/** Identity map — residential vs CRE codes stay distinct. */
export const CANONICAL_LOAN_PRODUCT_CODE: Record<string, string> = {};

/** Exact product code — residential vs CRE stay distinct on submit. */
export function resolveCanonicalLoanProductCode(code: string): string {
  const normalized = String(code || "").trim();
  if (!normalized) return "";
  return CANONICAL_LOAN_PRODUCT_CODE[normalized] || normalized;
}
