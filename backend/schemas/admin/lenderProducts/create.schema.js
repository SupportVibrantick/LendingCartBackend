// schemas/admin/lenderProducts/create.schema.js
const { z } = require("zod");

const loanProductEnum = z.enum([
  /* ================= SBA / GOVERNMENT ================= */
  "SBA",
  "SBA_7A",
  "SBA_504",
  "SBA_EXPRESS",
  "SBA_CAPLINES",
  "SBA_MICROLOAN",
  "SBA_DISASTER",
  "SBA_EXPORT",
  "VA_BUSINESS",

  /* ================= USDA ================= */
  "USDA_BUSINESS",
  "USDA_RURAL_DEVELOPMENT",
  "USDA_FARM_OWNERSHIP",
  "USDA_FARM_OPERATING",

  /* ================= COMMERCIAL REAL ESTATE ================= */
  "CRE_PURCHASE",
  "CRE_REFINANCE",
  "CRE_CASH_OUT",
  "OWNER_OCCUPIED_CRE",
  "INVESTOR_CRE",
  "CMBS",

  /* ================= CONSTRUCTION ================= */
  "GROUND_UP_CONSTRUCTION",
  "CONSTRUCTION_TO_PERM",
  "COMMERCIAL_CONSTRUCTION",
  "LAND_DEVELOPMENT",
  "LAND_ACQUISITION",

  /* ================= RESIDENTIAL / MORTGAGE ================= */
  "CONVENTIONAL_MORTGAGE",
  "FHA_LOAN",
  "VA_HOME_LOAN",
  "USDA_HOME_LOAN",
  "NON_QM",
  "JUMBO_LOAN",
  "REVERSE_MORTGAGE",
  "HELOC",
  "HOME_EQUITY",

  /* ================= RESIDENTIAL INVESTMENT ================= */
  "DSCR_RENTAL",
  "FIX_AND_FLIP",
  "BRIDGE_REALESTATE",
  "HARD_MONEY",
  "RENTAL_PORTFOLIO",

  /* ================= BUSINESS ================= */
  "BUSINESS_TERM",
  "WORKING_CAPITAL",
  "BUSINESS_LINE_OF_CREDIT",
  "STARTUP_FINANCING",
  "SMALL_BUSINESS_LOAN",

  /* ================= EQUIPMENT / AUTO ================= */
  "EQUIPMENT_FINANCE",
  "EQUIPMENT_LEASE",
  "COMMERCIAL_AUTO",
  "FLEET_FINANCE",
  "HEAVY_EQUIPMENT",

  /* ================= ASSET BASED / TRADE ================= */
  "ASSET_BASED_LENDING",
  "ACCOUNTS_RECEIVABLE",
  "INVOICE_FACTORING",
  "PURCHASE_ORDER",
  "INVENTORY_FINANCE",
  "TRADE_FINANCE",

  /* ================= ALT / PRIVATE CREDIT ================= */
  "MERCHANT_CASH_ADVANCE",
  "REVENUE_BASED_FINANCE",
  "PRIVATE_CREDIT",
  "MEZZANINE_FINANCE",
  "VENTURE_DEBT",

  /* ================= FRANCHISE / INDUSTRY ================= */
  "FRANCHISE_FINANCE",
  "HOTEL_FINANCE",
  "RESTAURANT_FINANCE",
  "MEDICAL_PRACTICE",
  "DENTAL_PRACTICE",
  "LAW_FIRM_FINANCE",

  /* ================= AGRICULTURE ================= */
  "AGRICULTURE_OPERATING",
  "FARM_EQUIPMENT",
  "FARM_REAL_ESTATE",
  "LIVESTOCK_LOAN",

  /* ================= CONSUMER ================= */
  "PERSONAL_LOAN",
  "AUTO_LOAN",
  "STUDENT_LOAN",
  "STUDENT_LOAN_REFINANCE",
  "PAYDAY_LOAN",
  "BNPL",

  "BRIDGE",
  "CONSTRUCTION",

  /* ================= FALLBACK ================= */
  "CUSTOM",
]);

const decimalField = z.union([z.string(), z.number()]).optional();

const createLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),

  // multiple loan product codes
  loanProductCodes: z.array(loanProductEnum).min(1),

  businessTypes: z.array(z.string()).optional(),

  minLoanAmount: decimalField,
  maxLoanAmount: decimalField,

  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),

  minLtvPercent: decimalField,
  maxLtvPercent: decimalField,

  minCreditScore: z.number().int().nonnegative().optional(),
  minExperience: z.string().optional(),

  interestRateRange: z.string().optional(),

  statesSupported: z.array(z.string()).optional(),

  isActive: z.boolean().optional(),
});

module.exports = { createLenderProductSchema };