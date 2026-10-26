/**
 * Shared loan-product alias helpers.
 * Bridge / Construction / Rental Portfolio residential vs CRE codes are distinct
 * products and are not aliased together.
 */

const LOAN_PRODUCT_ALIAS_GROUPS = [];

/** Legacy map kept for callers; identity for all current catalog codes. */
const CANONICAL_LOAN_PRODUCT_CODE = {};

/**
 * @param {string | null | undefined} code
 * @returns {string[]}
 */
function expandLoanProductAliasCodes(code) {
  const normalized = String(code || "").trim();
  if (!normalized) return [];

  const group = LOAN_PRODUCT_ALIAS_GROUPS.find((codes) =>
    codes.includes(normalized),
  );
  return group ? [...group] : [normalized];
}

/**
 * @param {string | null | undefined} code
 * @returns {string}
 */
function resolveCanonicalLoanProductCode(code) {
  const normalized = String(code || "").trim();
  if (!normalized) return "";
  return CANONICAL_LOAN_PRODUCT_CODE[normalized] || normalized;
}

module.exports = {
  LOAN_PRODUCT_ALIAS_GROUPS,
  CANONICAL_LOAN_PRODUCT_CODE,
  expandLoanProductAliasCodes,
  resolveCanonicalLoanProductCode,
};
