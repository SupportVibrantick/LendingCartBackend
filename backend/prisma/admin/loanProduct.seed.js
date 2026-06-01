const prisma = require("../client");

async function seedLoanProducts() {
  const products = [
    {
      code: "BRIDGE_LOAN",
      name: "Bridge Loan",
    },
    {
      code: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
      name: "FIX & FLIP",
    },
    {
      code: "DSCR_LOAN_1_TO_4_UNITS",
      name: "DSCR / Rental",
    },
    {
      code: "CONSTRUCTION_LOAN_1_TO_4_UNITS",
      name: "CONSTRUCTION",
    },
    {
      code: "RENTAL_PORTFOLIO",
      name: "Rental Portfolio",
    },
    {
      code: "CRE_PERMANENT_LOAN",
      name: "CRE Permanent",
    },
    {
      code: "CMBS",
      name: "CMBS",
    },
    {
      code: "AGENCY_LOAN_MULTIFAMILY",
      name: "Agency Multifamily",
    },
    {
      code: "MEZZANINE_FINANCE",
      name: "Mezzanine",
    },
    {
      code: "PREFERRED_EQUITY",
      name: "Preferred Equity",
    },
    // {
    //   code: "SBA_7A",
    //   name: "SBA 7(a) — General",
    // },
    {
      code: "SBA_7A_BUSINESS_ACQUISITION",
      name: "SBA 7(a) — Business Acquisition",
    },
    {
      code: "SBA_7A_WORKING_CAPITAL",
      name: "SBA 7(a) — Working Capital",
    },
    {
      code: "SBA_7A_EQUIPMENT_PURCHASE",
      name: "SBA 7(a) — Equipment",
    },
    {
      code: "SBA_7A_REAL_ESTATE",
      name: "SBA 7(a) — Real Estate",
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
      code: "PURCHASE_ORDER_FINANCE",
      name: "Purchase Order Financing",
    },
    {
      code: "EQUIPMENT_FINANCE",
      name: "Equipment Finance",
    },
    {
      code: "INVOICE_FACTORING",
      name: "AR Factoring",
    },
    {
      code: "ACCOUNTS_PAYABLE_FINANCE",
      name: "AP Supply Chain",
    },
    {
      code: "ACCOUNTS_RECEIVABLE",
      name: "Accounts Receivable",
      category: "ASSET_BASED_LENDING",
    },
  ];

  for (const product of products) {
    const existing = await prisma.loanProduct.findFirst({
      where: {
        code: product.code,
      },
    });

    if (!existing) {
      await prisma.loanProduct.create({
        data: {
          code: product.code,
          name: product.name,
          isActive: true,
        },
      });

      console.log(`✅ Created loan product: ${product.name}`);
    } else {
      console.log(`ℹ️ Loan product already exists: ${product.name}`);
    }
  }

  console.log("✅ Loan products seeded");
}

module.exports = {
  seedLoanProducts,
};
