/**
 * Shared loan-product alias groups for Residential 1-4 ↔ CRE variants.
 * Used by lender discovery, documents, and any exact product-code match.
 */

const LOAN_PRODUCT_ALIAS_GROUPS = [
  ["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"],
  ["CONSTRUCTION_LOAN", "CONSTRUCTION_LOAN_1_TO_4_UNITS"],
];

/** Residential / duplicate variant → canonical catalog code. */
const CANONICAL_LOAN_PRODUCT_CODE = {
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE_LOAN",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION_LOAN",
};

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
