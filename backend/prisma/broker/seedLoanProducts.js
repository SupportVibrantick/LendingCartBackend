// prisma/seedLoanProducts.js

const { PrismaClient, LoanProductCode } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * ==========================================
 * CATEGORY MAP
 * ==========================================
 */

const CATEGORY_MAP = {
  // SBA & USDA
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA_USDA",
  SBA_7A_WORKING_CAPITAL: "SBA_USDA",
  SBA_7A_BUSINESS_ACQUISITION: "SBA_USDA",
  SBA_7A_EQUIPMENT_PURCHASE: "SBA_USDA",
  SBA_7A_REAL_ESTATE: "SBA_USDA",
  USDA_BI: "SBA_USDA",

  // CRE & Multifamily
  BRIDGE_LOAN: "CRE_MULTIFAMILY",
  CMBS: "CRE_MULTIFAMILY",
  CONSTRUCTION_LOAN: "CRE_MULTIFAMILY",
  AGENCY_LOAN_MULTIFAMILY: "CRE_MULTIFAMILY",
  RENTAL_PORTFOLIO: "CRE_MULTIFAMILY",
  CRE_PERMANENT_LOAN: "CRE_MULTIFAMILY",
  MEZZANINE_FINANCE: "CRE_MULTIFAMILY",
  PREFERRED_EQUITY: "CRE_MULTIFAMILY",

  // Asset Based Lending
  PURCHASE_ORDER_FINANCE: "ABL",
  ACCOUNTS_PAYABLE_FINANCE: "ABL",
  ASSET_BASED_LENDING: "ABL",
  INVOICE_FACTORING: "ABL",

  // Residential
  DSCR_LOAN_1_TO_4_UNITS: "RESIDENTIAL_1_4",
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "RESIDENTIAL_1_4",
  BRIDGE_LOAN_1_TO_4_UNITS: "RESIDENTIAL_1_4",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "RESIDENTIAL_1_4",
};

/**
 * ==========================================
 * LOAN PRODUCTS
 * ==========================================
 */

const PRODUCTS = [
  /**
   * SBA & USDA
   */

  {
    code: LoanProductCode.SBA_504_REAL_ESTATE_AND_EQUIPMENT,
    name: "SBA 504 Real Estate & Equipment",
    description:
      "Long-term fixed-rate financing for owner-occupied real estate and equipment.",
  },

  {
    code: LoanProductCode.SBA_7A_WORKING_CAPITAL,
    name: "SBA 7A Working Capital",
    description: "Flexible working capital financing backed by SBA.",
  },

  {
    code: LoanProductCode.SBA_7A_BUSINESS_ACQUISITION,
    name: "SBA 7A Business Acquisition",
    description: "Financing for acquiring existing businesses and franchises.",
  },

  {
    code: LoanProductCode.SBA_7A_EQUIPMENT_PURCHASE,
    name: "SBA 7A Equipment Purchase",
    description: "Equipment and machinery financing backed by SBA.",
  },

  {
    code: LoanProductCode.SBA_7A_REAL_ESTATE,
    name: "SBA 7A Real Estate",
    description:
      "Commercial real estate financing for owner-occupied properties.",
  },

  {
    code: LoanProductCode.USDA_BI,
    name: "USDA B&I",
    description: "USDA Business & Industry financing for rural businesses.",
  },

  /**
   * CRE & Multifamily
   */

  {
    code: LoanProductCode.BRIDGE_LOAN,
    name: "Bridge Loan",
    description: "Short-term bridge financing for commercial properties.",
  },

  {
    code: LoanProductCode.CMBS,
    name: "CMBS Loan",
    description: "Commercial mortgage-backed securities financing.",
  },

  {
    code: LoanProductCode.CONSTRUCTION_LOAN,
    name: "Construction Loan",
    description: "Ground-up and major renovation financing.",
  },

  {
    code: LoanProductCode.AGENCY_LOAN_MULTIFAMILY,
    name: "Agency Loan (Multifamily)",
    description: "Fannie Mae and Freddie Mac multifamily financing.",
  },

  {
    code: LoanProductCode.RENTAL_PORTFOLIO,
    name: "Rental Portfolio Loan",
    description: "Blanket financing for multiple rental properties.",
  },

  {
    code: LoanProductCode.CRE_PERMANENT_LOAN,
    name: "CRE Permanent Loan",
    description: "Long-term stabilized commercial real estate financing.",
  },

  {
    code: LoanProductCode.MEZZANINE_FINANCE,
    name: "Mezzanine Finance",
    description: "Structured subordinate commercial financing.",
  },

  {
    code: LoanProductCode.PREFERRED_EQUITY,
    name: "Preferred Equity",
    description: "Preferred equity financing solution.",
  },

  /**
   * Asset Based Lending
   */

  {
    code: LoanProductCode.PURCHASE_ORDER_FINANCE,
    name: "Purchase Order Finance",
    description: "Financing for supplier purchase orders and inventory.",
  },

  {
    code: LoanProductCode.ACCOUNTS_PAYABLE_FINANCE,
    name: "Accounts Payable Finance",
    description: "Vendor and supplier payment financing.",
  },

  {
    code: LoanProductCode.ASSET_BASED_LENDING,
    name: "Asset Based Lending",
    description:
      "Financing secured by receivables, inventory, and business assets.",
  },

  {
    code: LoanProductCode.INVOICE_FACTORING,
    name: "Invoice Factoring",
    description: "Accounts receivable and invoice financing solution.",
  },

  /**
   * Residential
   */

  {
    code: LoanProductCode.DSCR_LOAN_1_TO_4_UNITS,
    name: "DSCR Loan (1-4 Units)",
    description: "Debt-service coverage ratio rental property loan.",
  },

  {
    code: LoanProductCode.FIX_AND_FLIP_LOAN_1_TO_4_UNITS,
    name: "Fix & Flip Loan (1-4 Units)",
    description: "Short-term rehab financing for residential properties.",
  },

  {
    code: LoanProductCode.BRIDGE_LOAN_1_TO_4_UNITS,
    name: "Bridge Loan (1-4 Units)",
    description: "Residential bridge financing for investment properties.",
  },

  {
    code: LoanProductCode.CONSTRUCTION_LOAN_1_TO_4_UNITS,
    name: "Construction Loan (1-4 Units)",
    description: "Ground-up residential construction financing.",
  },
];

/**
 * ==========================================
 * SEED FUNCTION
 * ==========================================
 */

async function main() {
  console.log("\n🌱 Seeding USA Loan Products...\n");

  const activeApplication = await prisma.brokerApplication.findFirst({
    where: {
      isActive: true,
    },
  });

  if (!activeApplication) {
    throw new Error("No active broker application found.");
  }

  for (const product of PRODUCTS) {
    const existing = await prisma.brokerApplicationProduct.findFirst({
      where: {
        brokerApplicationId: activeApplication.id,

        loanProductCode: product.code,
      },
    });

    if (existing) {
      console.log(`⚠️ Already Exists: ${product.name}`);
      continue;
    }

    await prisma.brokerApplicationProduct.create({
      data: {
        brokerApplicationId: activeApplication.id,

        loanProductCode: product.code,

        isActive: true,
      },
    });

    console.log(`✅ Created: ${product.name}`);
  }

  console.log("\n🎉 USA Loan Products Seeded Successfully.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
