/**
 * Canonical loan product codes/names used across prisma seed scripts.
 * Keep in sync with admin loan product seed / production catalog.
 */
const LOAN_PRODUCTS = [
  {
    code: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    name: "Fix & Flip (1-4 Units Residential)",
  },
  {
    code: "DSCR_LOAN_1_TO_4_UNITS",
    name: "DSCR / Rental (1-4 Units Residential)",
  },
  {
    code: "BRIDGE_LOAN",
    name: "Bridge Loan (1-4 Units Residential / CRE & Multifamily)",
  },
  {
    code: "BRIDGE_LOAN_1_TO_4_UNITS",
    name: "Bridge",
  },
  {
    code: "CONSTRUCTION_LOAN",
    name: "Construction (1-4 Units Residential / CRE & Multifamily)",
  },
  {
    code: "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    name: "Construction (1-4 Units)",
  },
  {
    code: "RENTAL_PORTFOLIO",
    name: "Rental Portfolio (1-4 Units Residential / CRE & Multifamily)",
  },
  {
    code: "CRE_PERMANENT_LOAN",
    name: "CRE Permanent (CRE & Multifamily)",
  },
  {
    code: "AGENCY_LOAN_MULTIFAMILY",
    name: "Agency Multifamily (CRE & Multifamily)",
  },
  {
    code: "CMBS",
    name: "CMBS (CRE & Multifamily)",
  },
  {
    code: "MEZZANINE_FINANCE",
    name: "Mezzanine (CRE & Multifamily)",
  },
  {
    code: "SBA_7A_BUSINESS_ACQUISITION",
    name: "SBA 7(a) — Business Acquisition",
  },
  {
    code: "SBA_7A_REAL_ESTATE",
    name: "SBA 7(a) — Real Estate",
  },
  {
    code: "SBA_7A_EQUIPMENT_PURCHASE",
    name: "SBA 7(a) — Equipment Finance",
  },
  {
    code: "SBA_7A_WORKING_CAPITAL",
    name: "SBA 7(a) — Working Capital",
  },
  {
    code: "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    name: "SBA 504 Real Estate",
  },
  {
    code: "USDA_BI",
    name: "USDA B&I",
  },
  {
    code: "ACCOUNTS_RECEIVABLE",
    name: "Accounts Receivable Finance (Asset Based Lending)",
  },
  {
    code: "ACCOUNTS_PAYABLE_FINANCE",
    name: "Accounts Payable Finance (Asset Based Lending)",
  },
  {
    code: "EQUIPMENT_FINANCE",
    name: "Equipment Finance (Asset Based Lending)",
  },
  {
    code: "PURCHASE_ORDER_FINANCE",
    name: "Purchase Order Financing (Asset Based Lending)",
  },
];

const LOAN_PRODUCT_CODES = LOAN_PRODUCTS.map((product) => product.code);

const BROKER_APPLICATION_PRODUCT_CODES = LOAN_PRODUCT_CODES;

module.exports = {
  LOAN_PRODUCTS,
  LOAN_PRODUCT_CODES,
  BROKER_APPLICATION_PRODUCT_CODES,
};
