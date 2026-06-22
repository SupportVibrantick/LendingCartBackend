/**
 * Canonical loan product codes/names used across prisma seed scripts.
 */
const LOAN_PRODUCTS = [
  { code: "BRIDGE_LOAN", name: "Bridge Loan" },
  { code: "BRIDGE_LOAN_1_TO_4_UNITS", name: "Bridge" },
  { code: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS", name: "Fix & Flip" },
  { code: "DSCR_LOAN_1_TO_4_UNITS", name: "DSCR / Rental" },
  { code: "CONSTRUCTION_LOAN", name: "Construction" },
  { code: "CONSTRUCTION_LOAN_1_TO_4_UNITS", name: "Construction (1-4 Units)" },
  { code: "RENTAL_PORTFOLIO", name: "Rental Portfolio" },
  { code: "CRE_PERMANENT_LOAN", name: "CRE Permanent" },
  { code: "CMBS", name: "CMBS" },
  { code: "AGENCY_LOAN_MULTIFAMILY", name: "Agency Multifamily" },
  { code: "MEZZANINE_FINANCE", name: "Mezzanine" },
  { code: "PREFERRED_EQUITY", name: "Preferred Equity" },
  { code: "SBA_7A", name: "SBA 7(a) — General" },
  { code: "SBA_7A_BUSINESS_ACQUISITION", name: "SBA 7(a) — Business Acquisition" },
  { code: "SBA_7A_WORKING_CAPITAL", name: "SBA 7(a) — Working Capital" },
  { code: "SBA_7A_EQUIPMENT_PURCHASE", name: "SBA 7(a) — Equipment" },
  { code: "SBA_7A_REAL_ESTATE", name: "SBA 7(a) — Real Estate" },
  { code: "SBA_504_REAL_ESTATE_AND_EQUIPMENT", name: "SBA 504" },
  { code: "USDA_BI", name: "USDA B&I" },
  { code: "PURCHASE_ORDER_FINANCE", name: "Purchase Order Financing" },
  { code: "EQUIPMENT_FINANCE", name: "Equipment Finance" },
  { code: "INVOICE_FACTORING", name: "AR Factoring" },
  { code: "ACCOUNTS_PAYABLE_FINANCE", name: "AP Supply Chain" },
  { code: "ACCOUNTS_RECEIVABLE", name: "Accounts Receivable" },
  { code: "ASSET_BASED_LENDING", name: "Asset Based Lending" },
];

const LOAN_PRODUCT_CODES = LOAN_PRODUCTS.map((product) => product.code);

const BROKER_APPLICATION_PRODUCT_CODES = LOAN_PRODUCT_CODES;

module.exports = {
  LOAN_PRODUCTS,
  LOAN_PRODUCT_CODES,
  BROKER_APPLICATION_PRODUCT_CODES,
};
