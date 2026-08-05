// Static constants used by the LoanApplication form, extracted out of the
// monolithic LoanApplication.tsx for readability. Nothing here mutates runtime
// state — these are pure data tables.

import { Building2, HomeIcon, Landmark, Settings } from "lucide-react";

import type { LoanCategory } from "./types";

/* ================= US States ================= */

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

/* ================= All Loan Purposes (fallback) ================= */

export const ALL_LOAN_PURPOSES = [
  "Purchase / Acquisition",
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
  "Construction Completion",
  "Ground-up Construction",
  "Major Renovation (>50%)",
  "Tenant Improvements",
  "Infrastructure Development",
  "Purchase & Rehab",
  "Refinance & Rehab",
  "Portfolio Blanket",
  "Recapitalization",
  "Gap Finance",
  "Leverage Enhancement",
  "JV Equity",
  "Acquisition Bridge",
  "Affordable Housing",
  "Supplement Loan",
  "Partner Buyout",
  "Franchise Purchase",
  "Business Expansion",
  "Inventory Purchase",
  "Marketing / Expansion",
  "Debt Consolidation",
  "Seasonal Line",
  "New Equipment",
  "Used Equipment",
  "Refinance Existing Equipment",
  "Equipment Line",
  "Real Estate Acquisition",
  "Real Estate Construction",
  "Heavy Equipment",
  "Refinance (504 Debt)",
  "Business Acquisition",
  "Real Estate Purchase",
  "Equipment Purchase",
  "Working Capital",
  "Debt Refinancing",
  "New Equipment Purchase",
  "Used Equipment Purchase",
  "Sale-LeaseBack",
  "Refinance / Consolidation",
  "Single PO Funding",
  "PO Line of Credit",
  "International PO",
  "Government PO",
  "Invoice Factoring",
  "ABL Line",
  "Selective Receivable Finance",
  "International Receivables",
  "Supplier Finance Program",
  "Dynamic Discounting",
  "Reverse Factoring",
  "Supply Chain Finance",
];

/* ================= Category -> Loan Product Codes ================= */

export const CATEGORY_LOAN_TYPES: Record<
  Exclude<LoanCategory, "">,
  string[]
> = {
  /**
   * ==========================================
   * 1-4 Units Residential
   * ==========================================
   */
  RESIDENTIAL_1_4: [
    "BRIDGE_LOAN_1_TO_4_UNITS",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
  ],

  /**
   * ==========================================
   * CRE & Multifamily
   * ==========================================
   */
  CRE_MULTIFAMILY: [
    "VALUE_ADDED_PROPERTY",
    "BRIDGE_LOAN",
    "CONSTRUCTION_LOAN",
    "RENTAL_PORTFOLIO",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
    "MEZZANINE_FINANCE",
  ],

  /**
   * ==========================================
   * SBA & USDA
   * ==========================================
   */
  SBA_USDA: [
    "SBA_7A_BUSINESS_ACQUISITION",
    "SBA_7A_WORKING_CAPITAL",
    "SBA_7A_EQUIPMENT_PURCHASE",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "USDA_BI",
  ],

  /**
   * ==========================================
   * Asset Based Lending
   * ==========================================
   */
  ABL: [
    "EQUIPMENT_FINANCE",
    "PURCHASE_ORDER_FINANCE",
    "ACCOUNTS_RECEIVABLE",
    "ACCOUNTS_RECEIVABLE_FINANCE",
    "ACCOUNTS_PAYABLE_FINANCE",
    "ASSET_BASED_LENDING",
  ],
};

/* ================= Product Display Labels ================= */

export const PRODUCT_LABELS: Record<string, string> = {
  // Residential
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge",
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  RENTAL_PORTFOLIO: "Rental Portfolio",

  // CRE
  BRIDGE_LOAN: "Bridge",
  CONSTRUCTION_LOAN: "Construction",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CMBS: "CMBS",
  MEZZANINE_FINANCE: "Mezz/Pref Equity",
  PREFERRED_EQUITY: "Preferred Equity",
  VALUE_ADDED_PROPERTY: "Value added property",

  // SBA
  SBA_7A_BUSINESS_ACQUISITION: "SBA 7a Acquisition",
  SBA_7A_WORKING_CAPITAL: "SBA 7a Working Capital",
  SBA_7A_EQUIPMENT_PURCHASE: "SBA 7a Equipment",
  SBA_7A_REAL_ESTATE: "SBA 7a Real Estate",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504 Real Estate",
  USDA_BI: "USDA B&I",

  // ABL
  EQUIPMENT_FINANCE: "Equipment Finance",
  PURCHASE_ORDER_FINANCE: "Purchase Order Finance",
  ACCOUNTS_RECEIVABLE_FINANCE: "Accounts Receivable",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  ACCOUNTS_PAYABLE_FINANCE: "Accounts Payable",
};

/* ================= Optional loan-request keys (skipped by validation) ================= */

export const OPTIONAL_LOAN_REQUEST_KEYS = new Set([
  "sellerFinancing",
  "sellerNoteAmount",
  "estimatedClosingDate",
  "brokerPoints",
  "amortization",
  "rateType",
  "interestRate",
  "recourse",
  "numberOfUnits",
  "subPropertyType",
  "rehabCost",
  "constructionCost",
  "useOfFunds",
  "exitStrategy",
  "currentLoanBalance",
]);

/* ================= Static field keys (skipped by dynamic-section validation) ================= */

export const STATIC_FIELD_KEYS = [
  // Loan Request
  "purpose",
  "amount",
  "interestRate",
  "sellerFinancing",
  "sellerNoteAmount",
  "estimatedClosingDate",
  "rateType",
  "brokerPoints",
  "amortization",
  "currentMarketValue",
  "purchasePrice",
  "purchaseDate",
  "afterRepairValue",
  "totalAssets",
  "totalLiabilities",
  "propertyType",
  "subPropertyType",
  "recourse",
  "businessAddress",
  "city",
  "state",
  "zip",

  // Loan Term
  "loanTerm",
  "monthlyRent",
  "grossRevenueActual",
  "grossRevenueProforma",
  "noiActual",
  "noiProforma",
  "annualTaxes",
  "floodZone",
  "insurancePremium",
  "hoaDues",

  // Borrower
  "name",
  "entityName",
  "phone",
  "email",
  "employer",
  "dob",
  "ssn",
  "creditScore",
  "address",
  "mailingAddress",

  // Entity
  "legalName",
  "entityType",
  "dba",
  "formationDate",
  "yearsInBusiness",
];

/* ================= Static dropdown options ================= */

export const ENTITY_TYPE_OPTIONS = [
  { value: "C-Corp", label: "C-Corp" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "LLC", label: "LLC" },
  { value: "Partnership", label: "Partnership" },
  { value: "Sole Proprietorship", label: "Sole Proprietorship" },
] as const;

export const RESIDENTIAL_1_4_PROPERTY_TYPES = [
  "Single Family (1-Unit)",
  "Duplex (2-Unit)",
  "Triplex (3-Unit)",
  "Fourplex (4-Unit)",
] as const;

/* ================= Category display data ================= */

export const CATEGORIES: LoanCategory[] = [
  "RESIDENTIAL_1_4",
  "CRE_MULTIFAMILY",
  "SBA_USDA",
  "ABL",
];

export const CATEGORY_ICONS: Record<string, any> = {
  RESIDENTIAL_1_4: HomeIcon,
  CRE_MULTIFAMILY: Building2,
  SBA_USDA: Landmark,
  ABL: Settings,
};

export const CATEGORY_LABELS: Record<string, string> = {
  RESIDENTIAL_1_4: "1-4 Units Residential",
  CRE_MULTIFAMILY: "CRE & Multifamily",
  SBA_USDA: "SBA & USDA",
  ABL: "Asset Based Lending",
};

/* ================= Loan-purpose dropdown (per product code) ================= */

export const LOAN_PURPOSE_MAP: Record<string, string[]> = {
  /* 1️⃣ Bridge Loan */
  BRIDGE_LOAN: [
    "Purchase/Acquisition",
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
    "Construction Completion",
  ],

  /* 2️⃣ Construction Loan */
  CONSTRUCTION_LOAN: [
    "Ground-up Construction",
    "Major Renovation (>50% of value)",
    "Tenant Improvements",
    "Infrastructure Development",
  ],

  /* 3️⃣ Fix & Flip */
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: ["Purchase & Rehab", "Refinance & Rehab"],

  MEZZANINE_FINANCE: [

  ],

  PREFERRED_EQUITY: ["Acquisition Bridge", "Recapitalization"],

  /* 4️⃣ DSCR */
  DSCR_LOAN_1_TO_4_UNITS: [
    "Purchase",
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
    "Portfolio Blanket",
  ],

  BRIDGE_LOAN_1_TO_4_UNITS: [
    "Purchase/Acquisition",
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
    "Construction Completion",
  ],

  CONSTRUCTION_LOAN_1_TO_4_UNITS: [
    "Ground-up Construction",
    "Major Renovation (>50% of value)",
    "Tenant Improvements",
    "Infrastructure Development",
  ],

  /* 5️⃣ CRE Permanent */
  CRE_PERMANENT_LOAN: ["Purchase", "Refinance", "Recapitalization"],

  RENTAL_PORTFOLIO: [
    "Purchase",
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
  ],

  /* 6️⃣ Mezz Finance / Pref Equity */
  // MEZZ_FINANCE_PREF_EQUITY: [
  //   "Gap Finance",
  //   "Leverage Enhancement",
  //   "JV Equity",
  //   "Acquisition Bridge",
  // ],

  /* 7️⃣ Agency Loan */
  AGENCY_LOAN_MULTIFAMILY: [
    "Purchase/Acquisition",
    "Cash Out Refinance",
    "Affordable Housing",
    "Supplement Loan",
  ],

  /* 8️⃣ CMBS */
  CMBS: [
    "Purchase/Acquisition",
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
  ],

  /* 9️⃣ SBA 7a - Business Acquisition */
  SBA_7A_BUSINESS_ACQUISITION: [
    "Purchase/Acquisition",
    "Partner Buyout",
    "Franchise Purchase",
    "Business Expansion",
  ],

  /* 🔟 SBA 7a - Working Capital */
  SBA_7A_WORKING_CAPITAL: [
    "Inventory Purchase",
    "Marketing/Expansion",
    "Debt Consolidation",
    "Seasonal Line",
  ],

  /* 11️⃣ SBA 7a - Equipment Purchase */
  SBA_7A_EQUIPMENT_PURCHASE: [
    "New Equipment",
    "Used Equipment",
    "Refinance Existing Equipment",
    "Equipment Line",
  ],

  /* 12️⃣ SBA 7a - Real Estate */
  SBA_7A_REAL_ESTATE: [
    "Purchase (Owner-Occupied)",
    "Construction",
    "Refinance",
    "New Construction",
    "Purchase & Rehab",
    "Refinance & Rehab",
  ],

  /* 13️⃣ SBA 504 */
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: [
    "Real Estate Acquisition",
    "Real Estate Construction",
    "Heavy Equipment",
    "Refinance (504 Debt)",
  ],

  /* 14️⃣ USDA B&I */
  USDA_BI: [
    "Business Acquisition",
    "Real Estate Purchase",
    "Equipment Purchase",
    "Working Capital",
    "Debt Refinancing",
  ],

  /* 15️⃣ Equipment Finance */
  EQUIPMENT_FINANCE: [
    "New Equipment Purchase",
    "Used Equipment Purchase",
    "Sale-Leaseback",
    "Refinance/Consolidation",
  ],

  /* 16️⃣ Purchase Order Finance */
  PURCHASE_ORDER_FINANCE: [
    "Single PO Funding",
    "PO Line of Credit",
    "International PO",
    "Government PO",
  ],

  /* 17️⃣ Accounts Receivable Finance */
  ACCOUNTS_RECEIVABLE_FINANCE: [
    "Invoice Factoring",
    "ABL Line",
    "Selective Receivable Finance",
    "International Receivables",
  ],

  ACCOUNTS_RECEIVABLE: [
    "Invoice Factoring",
    "ABL Line",
    "Selective Receivable Finance",
    "International Receivables",
  ],

  /* 18️⃣ Accounts Payable Finance */
  ACCOUNTS_PAYABLE_FINANCE: [
    "Supplier Finance Program",
    "Dynamic Discounting",
    "Reverse Factoring",
    "Supply Chain Finance",
  ],
};

/* ================= Top-level purpose + sub-purpose maps =================
 * Some products (currently CONSTRUCTION_LOAN_1_TO_4_UNITS) split loan purpose
 * into a broad category shown first ("Loan Purpose") and a specific item
 * shown beneath it ("Sub-Loan Purpose"). For all other products the
 * LOAN_PURPOSE_MAP above is used directly.
 */

export const LOAN_TOP_PURPOSE_MAP: Record<string, string[]> = {
  CONSTRUCTION_LOAN_1_TO_4_UNITS: ["Purchase", "Refinance"],
  MEZZANINE_FINANCE: ["Purchase", "Refinance"]
};

export const LOAN_SUB_PURPOSE_MAP: Record<string, string[]> = {
  CONSTRUCTION_LOAN_1_TO_4_UNITS: [
    "Ground-up Construction",
    "Major Renovation (>50% of value)",
    "Tenant Improvements",
    "Infrastructure Development",
  ],
  MEZZANINE_FINANCE: [
    "Gap Finance",
    "Leverage Enhancement",
    "JV Equity",
    "Acquisition Bridge",
    "Construction Project",
  ]

};

/* ================= Property-type / sub-type map ================= */

export const PROPERTY_TYPE_MAP: Record<string, string[]> = {
  MULTIFAMILY: [
    "Garden",
    "Mid-Rise",
    "High-Rise",
    "Senior Housing",
    "Student Housing",
    "Affordable Housing",
  ],

  OFFICE: [
    "Central Business District",
    "Medical",
    "Creative",
    "Government",
    "Suburban",
  ],

  RETAIL: [
    "Strip Plaza",
    "Mall",
    "Single-Tenant",
    "Restaurant",
    "Automotive",
  ],

  INDUSTRIAL: [
    "Warehouse",
    "Manufacturing",
    "Flex",
    "Data Center",
    "Cold Storage",
  ],

  SPECIAL_PURPOSE: [
    "Car Wash",
    "Gas Station",
    "Self Storage",
    "Hospital",
    "School",
  ],

  LAND: ["Raw", "Entitled", "Developed", "Agriculture"],

  MIXED_USE: ["Horizontal", "Vertical", "Live & Work"],
};

/* ================= Product code alias groups ================= */

/** Shared Bridge / Construction codes across Residential 1-4 and CRE. */
export const LOAN_PRODUCT_CODE_ALIASES: Record<string, string[]> = {
  BRIDGE_LOAN: ["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"],
  BRIDGE_LOAN_1_TO_4_UNITS: ["BRIDGE_LOAN_1_TO_4_UNITS", "BRIDGE_LOAN"],
  CONSTRUCTION_LOAN: ["CONSTRUCTION_LOAN", "CONSTRUCTION_LOAN_1_TO_4_UNITS"],
  CONSTRUCTION_LOAN_1_TO_4_UNITS: [
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN",
  ],
};

/* ================= API base ================= */

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
