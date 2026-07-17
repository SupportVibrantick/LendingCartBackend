/**
 * Loan product list ordering:
 * 1) Residential priority (Fix & Flip, DSCR, Bridge, Construction)
 * 2) Other / mid-tier programs
 * 3) Commercial / CRE / SBA / ABL programs last
 */

const RESIDENTIAL_PRIORITY = [
  "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
  "FIX_AND_FLIP",
  "DSCR_LOAN_1_TO_4_UNITS",
  "DSCR_RENTAL",
  "DSCR",
  "BRIDGE_LOAN",
  "BRIDGE_LOAN_1_TO_4_UNITS",
  "BRIDGE",
  "BRIDGE_REALESTATE",
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
  "CONSTRUCTION",
  "GROUND_UP_CONSTRUCTION",
  "CONSTRUCTION_TO_PERM",
  "COMMERCIAL_CONSTRUCTION",
];

const COMMERCIAL_CODES = new Set([
  "CRE_PERMANENT_LOAN",
  "CMBS",
  "AGENCY_LOAN_MULTIFAMILY",
  "MEZZANINE_FINANCE",
  "PREFERRED_EQUITY",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "SBA_7A_WORKING_CAPITAL",
  "SBA_7A_BUSINESS_ACQUISITION",
  "SBA_7A_EQUIPMENT_PURCHASE",
  "SBA_7A_REAL_ESTATE",
  "SBA_7A",
  "SBA",
  "SBA_504",
  "SBA_EXPRESS",
  "SBA_CAPLINES",
  "SBA_MICROLOAN",
  "SBA_DISASTER",
  "SBA_EXPORT",
  "USDA_BI",
  "USDA_BUSINESS",
  "USDA_RURAL_DEVELOPMENT",
  "PURCHASE_ORDER_FINANCE",
  "PURCHASE_ORDER",
  "ACCOUNTS_PAYABLE_FINANCE",
  "ASSET_BASED_LENDING",
  "INVOICE_FACTORING",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_RECEIVABLE_FINANCE",
  "EQUIPMENT_FINANCE",
  "EQUIPMENT_LEASE",
  "INVENTORY_FINANCE",
  "TRADE_FINANCE",
  "MERCHANT_CASH_ADVANCE",
  "CRE_PURCHASE",
  "CRE_REFINANCE",
  "CRE_CASH_OUT",
  "OWNER_OCCUPIED_CRE",
  "INVESTOR_CRE",
  "COMMERCIAL_AUTO",
  "FLEET_FINANCE",
  "HEAVY_EQUIPMENT",
]);

function sortRank(code) {
  const priorityIndex = RESIDENTIAL_PRIORITY.indexOf(code);
  if (priorityIndex !== -1) {
    return { group: 0, order: priorityIndex };
  }
  if (COMMERCIAL_CODES.has(code)) {
    return { group: 2, order: 0 };
  }
  return { group: 1, order: 0 };
}

function sortLoanProductsByPriority(products = []) {
  return [...products].sort((a, b) => {
    const aRank = sortRank(a.code);
    const bRank = sortRank(b.code);

    if (aRank.group !== bRank.group) {
      return aRank.group - bRank.group;
    }

    if (aRank.group === 0 && aRank.order !== bRank.order) {
      return aRank.order - bRank.order;
    }

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

module.exports = {
  RESIDENTIAL_PRIORITY,
  COMMERCIAL_CODES,
  sortLoanProductsByPriority,
};
