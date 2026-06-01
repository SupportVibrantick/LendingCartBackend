// prisma/broker/applicationBuilder.seed.js

const prisma = require("../client");

async function seedApplicationBuilder() {
  console.log("🚀 Seeding Application Builder...");

  const brokerOrgName =
    process.env.SEED_BROKER_ORG_NAME || "LendingCart Broker";

const brokerOrg = await prisma.organization.findFirst({
  where: {
    type: "BROKER",
  },
});

if (!brokerOrg) {
  throw new Error("Broker organization not found");
}

  /*
   * ==========================================
   * STEP 1: CREATE APPLICATION
   * ==========================================
   */

  let application = await prisma.brokerApplication.findFirst({
    where: {
      brokerOrgId: brokerOrg.id,
      code: "main-loan-application",
    },
  });

  if (!application) {
    application = await prisma.brokerApplication.create({
      data: {
        brokerOrgId: brokerOrg.id,
        name: "Main Loan Application",
        code: "main-loan-application",
        isActive: true,
      },
    });

    console.log(`✅ Application created: ${application.name}`);
  } else {
    console.log(`ℹ️ Application already exists: ${application.name}`);
  }

  /*
   * ==========================================
   * STEP 2: ADD PRODUCTS
   * ==========================================
   */

  const loanProductCodes = [
    "BRIDGE_LOAN",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
    "CRE_PERMANENT_LOAN",
    "CMBS",
    "AGENCY_LOAN_MULTIFAMILY",
    "MEZZANINE_FINANCE",
    "PREFERRED_EQUITY",
    // "SBA_7A",
    "SBA_7A_BUSINESS_ACQUISITION",
    "SBA_7A_WORKING_CAPITAL",
    "SBA_7A_EQUIPMENT_PURCHASE",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "USDA_BI",
    "PURCHASE_ORDER_FINANCE",
    "EQUIPMENT_FINANCE",
    "INVOICE_FACTORING",
    "ACCOUNTS_PAYABLE_FINANCE",
    "ACCOUNTS_RECEIVABLE",
  ];

  const applicationProducts = [];

  for (const loanProductCode of loanProductCodes) {
    let product = await prisma.brokerApplicationProduct.findFirst({
      where: {
        brokerApplicationId: application.id,
        loanProductCode,
      },
    });

    if (!product) {
      product = await prisma.brokerApplicationProduct.create({
        data: {
          brokerApplicationId: application.id,
          loanProductCode,
        },
      });

      console.log(`✅ Product added: ${loanProductCode}`);
    }

    applicationProducts.push(product);
  }

  /*
   * ==========================================
   * STEP 3: ADD SECTIONS
   * ==========================================
   */


const dynamicSections = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: [
    {
      name: "Rehab Details",
      description: "Fix and Flip rehab details",
      sortOrder: 100,
    },
  ],

  MEZZANINE_FINANCE: [
  {
    name: "Mezzanine Details",
    description: "Mezzanine financing information",
    sortOrder: 100,
  },
],

PREFERRED_EQUITY: [
  {
    name: "Preferred Equity Details",
    description: "Preferred equity information",
    sortOrder: 100,
  },
],

USDA_BI: [
  {
    name: "USDA Details",
    description: "USDA business information",
    sortOrder: 100,
  },
],

SBA_7A_WORKING_CAPITAL: [
  {
    name: "Working Capital Details",
    description: "Working capital information",
    sortOrder: 100,
  },
],

SBA_7A_EQUIPMENT_PURCHASE: [
  {
    name: "Equipment Purchase Details",
    description: "Equipment purchase information",
    sortOrder: 100,
  },
],

SBA_7A_REAL_ESTATE: [
  {
    name: "Real Estate Details",
    description: "Real estate financing information",
    sortOrder: 100,
  },
],

SBA_504_REAL_ESTATE_AND_EQUIPMENT: [
  {
    name: "SBA 504 Details",
    description: "SBA 504 information",
    sortOrder: 100,
  },
],

  CONSTRUCTION_LOAN_1_TO_4_UNITS: [
    {
      name: "Construction Details",
      description: "Construction project information",
      sortOrder: 100,
    },
  ],

//   SBA_7A: [
//     {
//       name: "Business Financials",
//       description: "Business financial information",
//       sortOrder: 100,
//     },
//   ],

  SBA_7A_BUSINESS_ACQUISITION: [
    {
      name: "Business Acquisition Details",
      description: "Target business information",
      sortOrder: 100,
    },
  ],

  PURCHASE_ORDER_FINANCE: [
    {
      name: "Purchase Order Details",
      description: "PO financing information",
      sortOrder: 100,
    },
  ],

  EQUIPMENT_FINANCE: [
    {
      name: "Equipment Details",
      description: "Equipment information",
      sortOrder: 100,
    },
  ],

  INVOICE_FACTORING: [
    {
      name: "Receivables Details",
      description: "Accounts receivable information",
      sortOrder: 100,
    },
  ],

  ACCOUNTS_PAYABLE_FINANCE: [
    {
      name: "Payables Details",
      description: "Accounts payable information",
      sortOrder: 100,
    },
  ],

  ACCOUNTS_RECEIVABLE: [
  {
    name: "Accounts Receivable Details",
    description: "Accounts receivable financing information",
    sortOrder: 100,
  },
],

  CMBS: [
    {
      name: "CMBS Details",
      description: "CMBS underwriting information",
      sortOrder: 100,
    },
  ],

  AGENCY_LOAN_MULTIFAMILY: [
    {
      name: "Multifamily Details",
      description: "Agency multifamily information",
      sortOrder: 100,
    },
  ],

  DSCR_LOAN_1_TO_4_UNITS: [
  {
    name: "DSCR Metrics",
    description: "DSCR underwriting information",
    sortOrder: 100,
  },
],

BRIDGE_LOAN: [
  {
    name: "Bridge Loan Details",
    description: "Bridge financing information",
    sortOrder: 100,
  },
],

CRE_PERMANENT_LOAN: [
  {
    name: "CRE Financials",
    description: "Commercial real estate metrics",
    sortOrder: 100,
  },
],

RENTAL_PORTFOLIO: [
  {
    name: "Portfolio Details",
    description: "Rental portfolio information",
    sortOrder: 100,
  },
],
};

const dynamicFields = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: [
    {
      sectionName: "Rehab Details",
      fieldKey: "rehabBudget",
      label: "Rehab Budget",
      fieldType: "NUMBER",
      sortOrder: 1,
    },
    {
      sectionName: "Rehab Details",
      fieldKey: "estimatedRepairMonths",
      label: "Estimated Repair Months",
      fieldType: "NUMBER",
      sortOrder: 2,
    },
    {
      sectionName: "Rehab Details",
      fieldKey: "exitStrategy",
      label: "Exit Strategy",
      fieldType: "TEXTAREA",
      sortOrder: 3,
    },
  ],

  MEZZANINE_FINANCE: [
  {
    sectionName: "Mezzanine Details",
    fieldKey: "mezzanineAmount",
    label: "Mezzanine Amount",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

PREFERRED_EQUITY: [
  {
    sectionName: "Preferred Equity Details",
    fieldKey: "equityAmount",
    label: "Equity Amount",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

USDA_BI: [
  {
    sectionName: "USDA Details",
    fieldKey: "ruralLocation",
    label: "Rural Location",
    fieldType: "BOOLEAN",
    sortOrder: 1,
  },
],

SBA_7A_WORKING_CAPITAL: [
  {
    sectionName: "Working Capital Details",
    fieldKey: "workingCapitalNeed",
    label: "Working Capital Need",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

SBA_7A_EQUIPMENT_PURCHASE: [
  {
    sectionName: "Equipment Purchase Details",
    fieldKey: "equipmentPurchaseAmount",
    label: "Equipment Purchase Amount",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

SBA_7A_REAL_ESTATE: [
  {
    sectionName: "Real Estate Details",
    fieldKey: "realEstateCost",
    label: "Real Estate Cost",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

SBA_504_REAL_ESTATE_AND_EQUIPMENT: [
  {
    sectionName: "SBA 504 Details",
    fieldKey: "projectCost",
    label: "Project Cost",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
],

  CONSTRUCTION_LOAN_1_TO_4_UNITS: [
    {
      sectionName: "Construction Details",
      fieldKey: "constructionBudget",
      label: "Construction Budget",
      fieldType: "NUMBER",
      sortOrder: 1,
    },
    {
      sectionName: "Construction Details",
      fieldKey: "builderName",
      label: "Builder Name",
      fieldType: "TEXT",
      sortOrder: 2,
    },
    {
      sectionName: "Construction Details",
      fieldKey: "permitStatus",
      label: "Permit Status",
      fieldType: "SELECT",
      options: ["Approved", "Pending", "Not Applied"],
      sortOrder: 3,
    },
  ],

//   SBA_7A: [
//     {
//       sectionName: "Business Financials",
//       fieldKey: "annualRevenue",
//       label: "Annual Revenue",
//       fieldType: "NUMBER",
//       sortOrder: 1,
//     },
//     {
//       sectionName: "Business Financials",
//       fieldKey: "employeeCount",
//       label: "Employee Count",
//       fieldType: "NUMBER",
//       sortOrder: 2,
//     },
//   ],

  SBA_7A_BUSINESS_ACQUISITION: [
    {
      sectionName: "Business Acquisition Details",
      fieldKey: "targetBusinessName",
      label: "Target Business Name",
      fieldType: "TEXT",
      sortOrder: 1,
    },
    {
      sectionName: "Business Acquisition Details",
      fieldKey: "acquisitionPrice",
      label: "Acquisition Price",
      fieldType: "NUMBER",
      sortOrder: 2,
    },
  ],

  PURCHASE_ORDER_FINANCE: [
    {
      sectionName: "Purchase Order Details",
      fieldKey: "poAmount",
      label: "PO Amount",
      fieldType: "NUMBER",
      sortOrder: 1,
    },
    {
      sectionName: "Purchase Order Details",
      fieldKey: "buyerName",
      label: "Buyer Name",
      fieldType: "TEXT",
      sortOrder: 2,
    },
  ],

  EQUIPMENT_FINANCE: [
    {
      sectionName: "Equipment Details",
      fieldKey: "equipmentType",
      label: "Equipment Type",
      fieldType: "TEXT",
      sortOrder: 1,
    },
    {
      sectionName: "Equipment Details",
      fieldKey: "equipmentCost",
      label: "Equipment Cost",
      fieldType: "NUMBER",
      sortOrder: 2,
    },
  ],

  DSCR_LOAN_1_TO_4_UNITS: [
  {
    sectionName: "DSCR Metrics",
    fieldKey: "monthlyRentalIncome",
    label: "Monthly Rental Income",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "DSCR Metrics",
    fieldKey: "occupancyRate",
    label: "Occupancy Rate",
    fieldType: "PERCENTAGE",
    sortOrder: 2,
  },
  {
    sectionName: "DSCR Metrics",
    fieldKey: "dscrRatio",
    label: "DSCR Ratio",
    fieldType: "NUMBER",
    sortOrder: 3,
  },
],

BRIDGE_LOAN: [
  {
    sectionName: "Bridge Loan Details",
    fieldKey: "currentPropertyValue",
    label: "Current Property Value",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Bridge Loan Details",
    fieldKey: "existingLoanBalance",
    label: "Existing Loan Balance",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
  {
    sectionName: "Bridge Loan Details",
    fieldKey: "expectedRefinanceDate",
    label: "Expected Refinance Date",
    fieldType: "DATE",
    sortOrder: 3,
  },
],

CRE_PERMANENT_LOAN: [
  {
    sectionName: "CRE Financials",
    fieldKey: "noi",
    label: "NOI",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "CRE Financials",
    fieldKey: "capRate",
    label: "Cap Rate",
    fieldType: "PERCENTAGE",
    sortOrder: 2,
  },
  {
    sectionName: "CRE Financials",
    fieldKey: "tenantCount",
    label: "Tenant Count",
    fieldType: "NUMBER",
    sortOrder: 3,
  },
],

RENTAL_PORTFOLIO: [
  {
    sectionName: "Portfolio Details",
    fieldKey: "propertyCount",
    label: "Property Count",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Portfolio Details",
    fieldKey: "totalUnits",
    label: "Total Units",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
  {
    sectionName: "Portfolio Details",
    fieldKey: "monthlyRentalIncome",
    label: "Monthly Rental Income",
    fieldType: "NUMBER",
    sortOrder: 3,
  },
],
CMBS: [
  {
    sectionName: "CMBS Details",
    fieldKey: "dscr",
    label: "DSCR",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "CMBS Details",
    fieldKey: "wale",
    label: "WALE",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
],

AGENCY_LOAN_MULTIFAMILY: [
  {
    sectionName: "Multifamily Details",
    fieldKey: "unitCount",
    label: "Unit Count",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Multifamily Details",
    fieldKey: "affordableUnits",
    label: "Affordable Units",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
],

ACCOUNTS_RECEIVABLE: [
  {
    sectionName: "Accounts Receivable Details",
    fieldKey: "totalReceivables",
    label: "Total Receivables",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Accounts Receivable Details",
    fieldKey: "averageInvoiceAmount",
    label: "Average Invoice Amount",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
  {
    sectionName: "Accounts Receivable Details",
    fieldKey: "customerCount",
    label: "Customer Count",
    fieldType: "NUMBER",
    sortOrder: 3,
  },
  {
    sectionName: "Accounts Receivable Details",
    fieldKey: "averageCollectionDays",
    label: "Average Collection Days",
    fieldType: "NUMBER",
    sortOrder: 4,
  },
],

INVOICE_FACTORING: [
  {
    sectionName: "Receivables Details",
    fieldKey: "totalAR",
    label: "Total Accounts Receivable",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Receivables Details",
    fieldKey: "averageInvoiceSize",
    label: "Average Invoice Size",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
],

ACCOUNTS_PAYABLE_FINANCE: [
  {
    sectionName: "Payables Details",
    fieldKey: "totalAP",
    label: "Total Accounts Payable",
    fieldType: "NUMBER",
    sortOrder: 1,
  },
  {
    sectionName: "Payables Details",
    fieldKey: "supplierCount",
    label: "Supplier Count",
    fieldType: "NUMBER",
    sortOrder: 2,
  },
],
};

  /*
   * ==========================================
   * STEP 3A: ADD DYNAMIC SECTIONS
   * ==========================================
   */

  for (const product of applicationProducts) {
    const extraSections = dynamicSections[product.loanProductCode] || [];

    for (const section of extraSections) {
      const existingSection = await prisma.brokerApplicationSection.findFirst({
        where: {
          applicationProductId: product.id,
          name: section.name,
        },
      });

      if (!existingSection) {
        await prisma.brokerApplicationSection.create({
          data: {
            applicationProductId: product.id,
            name: section.name,
            description: section.description,
            sortOrder: section.sortOrder,
            isActive: true,
          },
        });

        console.log(`✅ Dynamic section created: ${section.name}`);
      }
    }
  }

  /*
 * ==========================================
 * STEP 4A: ADD DYNAMIC FIELDS
 * ==========================================
 */

for (const product of applicationProducts) {
  const productDynamicFields =
    dynamicFields[product.loanProductCode] || [];

  if (!productDynamicFields.length) continue;

  const productSections =
    await prisma.brokerApplicationSection.findMany({
      where: {
        applicationProductId: product.id,
      },
    });

  for (const field of productDynamicFields) {
    const section = productSections.find(
      (s) => s.name === field.sectionName
    );

    if (!section) continue;

    const existingField =
      await prisma.brokerApplicationProductField.findFirst({
        where: {
          applicationProductId: product.id,
          fieldKey: field.fieldKey,
        },
      });

    if (!existingField) {
      await prisma.brokerApplicationProductField.create({
data: {
  applicationProductId: product.id,
  sectionId: section.id,
  fieldKey: field.fieldKey,
  label: field.label,
  fieldType: field.fieldType,
  isRequired: false,
  options: field.options || null,
  validation: {},
  sortOrder: field.sortOrder,
}
      });

      console.log(
        `✅ Dynamic field created: ${field.fieldKey}`
      );
    }
  }
}

  console.log("🎉 Application Builder seeded successfully");

  return application;
}

module.exports = {
  seedApplicationBuilder,
};
