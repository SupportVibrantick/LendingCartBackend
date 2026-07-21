/**
 * Canonical loan product display order for public/admin product lists.
 * Unknown or legacy codes sort after these entries (alphabetically by name).
 */

const LOAN_PRODUCT_ORDER = [
  ["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS", "BRIDGE", "BRIDGE_REALESTATE"],
  ["FIX_AND_FLIP_LOAN_1_TO_4_UNITS", "FIX_AND_FLIP"],
  ["DSCR_LOAN_1_TO_4_UNITS", "DSCR", "DSCR_RENTAL"],
  [
    "CONSTRUCTION_LOAN",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION",
    "GROUND_UP_CONSTRUCTION",
    "CONSTRUCTION_TO_PERM",
    "COMMERCIAL_CONSTRUCTION",
  ],
  ["CRE_PERMANENT_LOAN"],
  ["AGENCY_LOAN_MULTIFAMILY"],
  ["CMBS"],
  [
    "MEZZANINE_FINANCE",
    "MEZZ_FINANCE",
    "PREFERRED_EQUITY",
    "MEZZ_FINANCE_PREF_EQUITY",
  ],
  ["SBA_7A_BUSINESS_ACQUISITION"],
  ["SBA_7A_REAL_ESTATE"],
  ["SBA_7A_EQUIPMENT_PURCHASE"],
  ["SBA_7A_WORKING_CAPITAL"],
  ["SBA_504_REAL_ESTATE_AND_EQUIPMENT", "SBA_504", "SBA_504_REAL_ESTATE_EQUIPMENT"],
  ["SBA_7A", "SBA", "SBA_EXPRESS", "SBA_CAPLINES", "SBA_MICROLOAN", "SBA_DISASTER", "SBA_EXPORT"],
  ["USDA_BI", "USDA_BUSINESS", "USDA_RURAL_DEVELOPMENT"],
  ["ACCOUNTS_RECEIVABLE", "ACCOUNTS_RECEIVABLE_FINANCE", "INVOICE_FACTORING"],
  ["ACCOUNTS_PAYABLE_FINANCE", "ASSET_BASED_LENDING"],
  ["EQUIPMENT_FINANCE", "EQUIPMENT_LEASE"],
  ["PURCHASE_ORDER_FINANCE", "PURCHASE_ORDER"],
];

const CODE_ORDER_INDEX = LOAN_PRODUCT_ORDER.reduce((index, codes, order) => {
  for (const code of codes) {
    if (!index.has(code)) {
      index.set(code, order);
    }
  }
  return index;
}, new Map());

function sortRank(code) {
  const order = CODE_ORDER_INDEX.get(code);
  return order === undefined ? Number.MAX_SAFE_INTEGER : order;
}

function sortLoanProductsByPriority(products = []) {
  return [...products].sort((a, b) => {
    const aOrder = sortRank(a.code);
    const bOrder = sortRank(b.code);

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

module.exports = {
  LOAN_PRODUCT_ORDER,
  CODE_ORDER_INDEX,
  sortLoanProductsByPriority,
};
