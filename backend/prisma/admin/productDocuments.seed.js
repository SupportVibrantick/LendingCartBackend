/**
 * Seed admin (platform) document types + product document requirements
 * for canonical loan programs used in the admin portal.
 *
 * Idempotent: safe to re-run. Creates missing DocumentType rows and
 * ProductDocumentRequirement links by (loanProductCode, documentTypeId).
 *
 * Run via: node prisma/seed.js
 * Or alone: node prisma/admin/productDocuments.seed.js
 */
const prisma = require("../client");

const SBA_7A_PRODUCT_CODES = [
  "SBA_7A_BUSINESS_ACQUISITION",
  "SBA_7A_REAL_ESTATE",
  "SBA_7A_EQUIPMENT_PURCHASE",
  "SBA_7A_WORKING_CAPITAL",
];

const BRIDGE_DOCS = [
  "Completed Loan Application",
  "Most Recent Personal Tax Return for all majority owners/guarantors",
  "Personal Financial Statement (PFS) for all guarantors",
  "Proof of Funds / Liquidity",
  "Purchase & Sale Agreement",
  "Current Property Deed / Vesting Information",
  "Current Mortgage / Loan Statement",
  "Current Rent Roll",
  "Current Lease Agreements",
  "Property Photos",
  "Scope of Work / Renovation Budget",
  "Contractor Estimates / Construction Budget",
  "Sources & Uses",
  "Property Insurance Information",
  "Entity Formation Documents / Operating Agreement",
  "Schedule of Real Estate Owned (REO)",
  "Business Bank Statements, if applicable",
  "Credit Authorization / Credit Report Authorization",
  "Purchase Contract or Refinance Payoff Statement",
  "Preliminary Title / Title Information",
];

const FIX_AND_FLIP_DOCS = [
  "Completed Loan Application",
  "Personal Financial Statement (PFS)",
  "Most Recent Personal Tax Return",
  "Proof of Funds / Liquidity",
  "Purchase & Sale Agreement",
  "Property Deed / Vesting Information",
  "Scope of Work",
  "Detailed Construction / Renovation Budget",
  "Contractor Bid(s) / Estimates",
  "Property Photos",
  "Comparable Sales / CMA",
  "After-Repair Value (ARV) Estimate / Broker Opinion",
  "Sources & Uses",
  "Current Mortgage / Payoff Statement",
  "Schedule of Real Estate Owned",
  "Entity Formation Documents / Operating Agreement",
  "Property Insurance Information",
  "Business Bank Statements",
  "Credit Authorization",
  "Construction Timeline / Project Schedule",
];

const DSCR_DOCS = [
  "Completed Loan Application",
  "Personal Financial Statement (PFS)",
  "Most Recent Personal Tax Return",
  "Proof of Funds / Liquidity",
  "Purchase & Sale Agreement",
  "Current Rent Roll",
  "Current Lease Agreements",
  "Property Photos",
  "Property Insurance Quote / Declaration Page",
  "Current Mortgage / Payoff Statement",
  "Schedule of Real Estate Owned",
  "Property Tax Information",
  "HOA Statement / Condo Documents",
  "Entity Formation Documents / Operating Agreement",
  "Business Bank Statements",
  "Sources & Uses",
  "Credit Authorization",
  "Property Management Agreement",
  "Preliminary Title / Vesting Information",
  "Existing Property Income & Expense Statement",
];

const CONSTRUCTION_1_TO_4_DOCS = [
  "Completed Loan Application",
  "Personal Financial Statement (PFS)",
  "Most Recent Personal Tax Return",
  "Proof of Funds / Equity Contribution",
  "Purchase & Sale Agreement / Land Contract",
  "Current Property Deed, if owned",
  "Detailed Construction Budget",
  "Complete Scope of Work",
  "Building Plans / Architectural Plans",
  "Site Plan",
  "Contractor Agreement",
  "Contractor License / Insurance Information",
  "Contractor Resume / Experience",
  "Construction Timeline / Schedule",
  "Building Permit / Permit Status",
  "Property Appraisal / As-Completed Value",
  "Property Photos / Site Photos",
  "Sources & Uses",
  "Schedule of Real Estate Owned",
  "Entity Formation Documents / Operating Agreement",
  "Property Insurance Information",
  "Preliminary Title Report",
  "Credit Authorization",
  "Environmental Report",
];

const CRE_PERMANENT_DOCS = [
  "Completed Commercial Loan Application",
  "Personal Financial Statement for all guarantors",
  "Most Recent Personal Tax Returns",
  "Entity / Borrower Tax Returns — Last 2–3 Years",
  "Interim Business / Property P&L",
  "Current Balance Sheet",
  "Current Rent Roll",
  "All Current Lease Agreements",
  "Trailing 12-Month Operating Statement (T-12)",
  "Property Income & Expense Statement",
  "Current Property Tax Bill",
  "Current Property Insurance",
  "Current Mortgage / Debt Statements",
  "Schedule of Real Estate Owned",
  "Purchase & Sale Agreement, if acquisition",
  "Property Photos",
  "Property Management Agreement, if applicable",
  "Organizational Documents / Operating Agreement",
  "Sources & Uses",
  "Existing Appraisal",
  "Environmental Report",
  "Property Survey / Site Plan",
  "Preliminary Title Report",
  "Business Bank Statements",
  "Credit Authorization",
];

const CRE_CONSTRUCTION_DOCS = [
  "Completed Commercial Loan Application",
  "Personal Financial Statement for all guarantors",
  "Personal Tax Returns — Most Recent 2–3 Years",
  "Borrower / Entity Tax Returns — Most Recent 2–3 Years, if applicable",
  "Interim P&L and Balance Sheet",
  "Last 6 months Business Bank Statements",
  "Proof of Equity / Available Liquidity",
  "Purchase & Sale Agreement / Land Contract",
  "Current Deed, if owned",
  "Detailed Construction Budget",
  "Detailed Scope of Work",
  "Architectural / Building Plans",
  "Site Plan",
  "Civil / Engineering Plans, if applicable",
  "Contractor Agreement",
  "Contractor License & Insurance",
  "Contractor Resume / Development Experience",
  "Construction Schedule",
  "Building Permits / Permit Status",
  "Sources & Uses",
  "Project Pro Forma",
  "Stabilized NOI Projection",
  "Rent Roll / Lease-Up Assumptions",
  "Property Tax Information",
  "Property Insurance Information",
  "Environmental / Phase I",
  "Preliminary Title Report",
  "Schedule of Real Estate Owned",
  "Entity Formation Documents",
  "Credit Authorization",
];

const CMBS_DOCS = [
  "Completed Commercial Loan Application",
  "Personal Financial Statement for Sponsors / Guarantors",
  "Personal Tax Returns",
  "Borrower Entity Tax Returns — Last 2–3 Years",
  "Interim P&L and Balance Sheet",
  "T-12 Operating Statement",
  "Current Rent Roll",
  "All Current Lease Agreements",
  "Property Income & Expense Statement",
  "Current Property Tax Bill",
  "Current Property Insurance",
  "Existing Loan / Mortgage Statement",
  "Existing Loan Documents, if applicable",
  "Schedule of Real Estate Owned",
  "Purchase & Sale Agreement, if acquisition",
  "Property Management Agreement",
  "Property Photos",
  "Property Survey",
  "Preliminary Title Report",
  "Existing Appraisal, if available",
  "Existing Environmental Report",
  "Sources & Uses",
  "Property Operating History",
  "Capital Improvements / Renovation History",
  "Entity Formation / Organizational Documents",
  "Business Bank Statements",
  "Credit Authorization",
];

const AGENCY_MULTIFAMILY_DOCS = [
  "Completed Multifamily Loan Application",
  "Personal Financial Statement for all Principals / Guarantors",
  "Personal Tax Returns",
  "Borrower / Entity Tax Returns — Last 2–3 Years",
  "Current Rent Roll",
  "T-12 Operating Statement",
  "Year-to-Date P&L",
  "Property Balance Sheet, if applicable",
  "Current Property Tax Bill",
  "Current Insurance Declaration Page",
  "Current Mortgage / Loan Statement",
  "Current Lease Agreements, if applicable",
  "Schedule of Real Estate Owned",
  "Purchase & Sale Agreement, if acquisition",
  "Property Management Agreement",
  "Property Photos",
  "Property Survey",
  "Existing Appraisal, if available",
  "Environmental / Phase I Report, if available",
  "Property Condition Assessment, if available",
  "Sources & Uses",
  "Organizational Documents",
  "Property Operating History",
  "Capital Improvements History",
  "Sponsor / Borrower Resume",
  "Sponsor / Borrower Real Estate Experience",
  "Last 6 months Business Bank Statements",
  "Verification Source of Liquidity",
  "Credit Authorization",
];

const SBA_7A_DOCS = [
  "Last 3 years and Interim Business Tax Returns",
  "Most Recent Personal Tax Return for majority owner(s)",
  "Business Bank Statements for the past 12 months",
  "Business Debt Schedule",
  "Most Recent Business Credit Card Statement(s)",
  "Most Recent Affiliated Business Tax Return",
  "Corporate Bylaws / Operating Agreement",
  "Active Lease Agreement, if applicable",
  "Schedule of Furniture, Fixtures & Equipment",
  "Personal Debt Schedule for majority owner(s)",
  "Interim P&L and Balance Sheet dated within 90 days",
  "Purchase & Sale Agreement, if acquisition",
  "Sources & Uses",
  "List of Inventory",
  "Business License / Professional License",
  "Business Formation Documents",
  "SBA-required ownership / personal history forms",
  "Business Acquisition Documents, if applicable",
  "Franchise Agreement / Franchise Documentation",
  "Equipment Quotes / Invoices",
  "Real Estate Purchase Agreement",
  "Lease / Property Information",
  "Existing Loan Statements",
  "Personal Financial Statement",
  "Credit Authorization",
];

const SBA_504_DOCS = [
  "Completed SBA 504 Loan Application",
  "Last 3 Years Business Tax Returns",
  "Most Recent Personal Tax Return for all majority owners",
  "Interim P&L and Balance Sheet dated within 90 days",
  "Last 6 months Business Bank Statements",
  "Business Debt Schedule",
  "Personal Financial Statement",
  "Personal Debt Schedule",
  "Purchase & Sale Agreement",
  "Real Estate Appraisal, if available",
  "Property Environmental Report",
  "Property Survey",
  "Construction / Renovation Budget",
  "Contractor Estimates",
  "Equipment Quotes / Invoices",
  "Sources & Uses",
  "Corporate Bylaws / Operating Agreement",
  "Business Formation Documents",
  "Active Lease Agreement",
  "Existing Mortgage / Loan Statement",
  "Schedule of Furniture, Fixtures & Equipment",
  "Business Licenses",
  "Affiliated Business Tax Returns",
  "Credit Authorization",
];

const USDA_BI_DOCS = [
  "Completed USDA B&I Loan Application",
  "Last 3 Years Business Tax Returns",
  "Most Recent Personal Tax Returns for Owners / Guarantors",
  "Interim P&L and Balance Sheet",
  "Business Bank Statements — Most Recent 12 Months",
  "Business Debt Schedule",
  "Personal Financial Statement",
  "Personal Debt Schedule",
  "Purchase & Sale Agreement, if applicable",
  "Sources & Uses",
  "Business Plan",
  "Detailed Project Description",
  "Projected Financial Statements / Pro Forma",
  "Cash Flow Projections",
  "Property Purchase Documents, if applicable",
  "Construction / Renovation Budget",
  "Equipment Quotes",
  "Appraisal",
  "Environmental Documentation",
  "Lease Agreement",
  "Business Formation / Organizational Documents",
  "Business Licenses / Permits",
  "Affiliated Business Information",
  "Schedule of Real Estate Owned",
  "Credit Authorization",
];

const EQUIPMENT_FINANCE_DOCS = [
  "Most Recent 2–3 Years Business Tax Returns",
  "Interim P&L and Balance Sheet",
  "Last 6 months Business Bank Statements",
  "Most Recent Personal Tax Return for Majority Owner(s)",
  "Personal Financial Statement",
  "Business Debt Schedule",
  "Equipment Quote / Purchase Order",
  "Equipment Description & Specifications",
  "Vendor / Supplier Information",
  "Equipment Invoice",
  "Equipment Appraisal / Valuation",
  "Sources & Uses",
  "Existing Equipment Schedule",
  "Corporate Formation Documents",
  "Business License",
  "Lease Agreement",
  "Credit Authorization",
];

const ACCOUNTS_RECEIVABLE_DOCS = [
  "Completed Loan Application",
  "Last 2–3 Years Business Tax Returns",
  "Interim P&L and Balance Sheet",
  "Last 6 months Business Bank Statements",
  "Current Accounts Receivable Aging Report",
  "Current Accounts Payable Aging Report",
  "Detailed Customer / Debtor List",
  "Top Customer Concentration Report",
  "A/R Invoice Sample(s)",
  "Current Sales / Revenue Report",
  "Customer Payment History",
  "Existing Business Debt Schedule",
  "Existing Factoring / A/R Financing Agreements",
  "Business Credit Card Statements, if applicable",
  "Personal Financial Statement",
  "Corporate Formation Documents",
  "Customer Contracts / Purchase Agreements",
  "UCC / Existing Lien Information",
  "Sources & Uses",
  "Credit Authorization",
];

const ACCOUNTS_PAYABLE_DOCS = [
  "Last 2–3 Years Business Tax Returns",
  "Interim P&L and Balance Sheet",
  "Last 6 months Business Bank Statements",
  "Current Accounts Payable Aging Report",
  "Current Accounts Receivable Aging Report",
  "Detailed Vendor / Supplier List",
  "Outstanding Vendor Invoices",
  "Purchase Orders",
  "Vendor Contracts / Agreements",
  "Current Sales / Revenue Report",
  "Customer List",
  "Business Debt Schedule",
  "Existing Financing / Factoring Agreements",
  "Business Credit Card Statements",
  "Personal Financial Statement",
  "Corporate Formation Documents",
  "Sources & Uses",
  "UCC / Existing Lien Information",
  "Credit Authorization",
];

const PURCHASE_ORDER_DOCS = [
  "Completed Loan Application",
  "Business Formation Documents",
  "Most Recent 2–3 Years Business Tax Returns",
  "Interim P&L and Balance Sheet",
  "Last 6 months Business Bank Statements",
  "Valid Purchase Order(s) from Customer",
  "Customer Contract / Sales Agreement",
  "Supplier / Vendor Quote",
  "Supplier Invoice, if applicable",
  "Detailed Cost of Goods / Fulfillment Costs",
  "Customer List",
  "Supplier List",
  "Customer Payment Terms",
  "Supplier Payment Terms",
  "Proof of Customer Creditworthiness",
  "Current Accounts Receivable Aging",
  "Current Accounts Payable Aging",
  "Business Debt Schedule",
  "Existing Financing / Factoring Agreements",
  "Fulfillment / Delivery Timeline",
  "Gross Margin / Profitability Analysis",
  "Sources & Uses",
  "Personal Financial Statement",
  "UCC / Existing Lien Information",
  "Credit Authorization",
];

/** Shared required docs for Mezzanine Finance & Preferred Equity. */
const MEZZANINE_PREFERRED_EQUITY_DOCS = [
  "Completed Loan Application",
  "Personal Financial Statement (PFS)",
  "Tax Returns",
  "Bank Statements",
  "Schedule of Real Estate Owned (SREO)",
  "Debt Schedule",
  "Track Record",
  "Credit Authorization",
  "Rent Roll",
  "Leases",
  "Trailing 12-Month Operating Statement (T-12)",
  "P&L",
  "Property Taxes",
  "Insurance",
  "Mortgage",
  "Appraisal",
  "Environmental",
  "Property Condition Assessment (PCA)",
  "Purchase Agreement",
  "Sources & Uses",
  "Capital Stack",
  "Senior Loan Terms",
  "Proposed Mezz / Pref Amount",
  "Sponsor Equity",
  "Exit Strategy",
  "Mezz Term Sheet",
  "Senior Loan Documents",
  "Intercreditor Agreement",
  "Subordination",
  "Security / UCC",
  "Pledge Agreement",
  "Pref Equity Term Sheet",
  "Operating Agreement",
  "Waterfall",
  "Preferred Return",
  "Sponsor Promote",
  "Governance / Consent Rights",
  "Redemption / Buyout Terms",
  "Plans",
  "Scope of Work",
  "Construction Budget",
  "Contractor Agreement",
  "Permits",
  "Construction Schedule",
  "Cost-to-Complete",
  "Draw Schedule",
];

const RENTAL_PORTFOLIO_DOCS = [
  "Personal Financial Statement",
  "Personal Tax Returns",
  "Bank Statements",
  "Personal Debt Schedule",
  "Credit Authorization",
  "Entity Tax Returns",
  "Articles of Organization",
  "Operating Agreement",
  "Ownership Structure",
  "Business Bank Statements",
  "Schedule of Real Estate Owned",
  "Portfolio Rent Roll",
  "Portfolio Debt Schedule",
  "Portfolio Income & Expense",
  "Portfolio Cash Flow",
  "Lease",
  "Property Tax",
  "Insurance",
  "Mortgage Statement",
  "Deed",
  "HOA",
  "Property Photos",
  "Property Management Agreement",
  "Purchase & Sale Agreement",
  "Sources & Uses",
  "Proof of Equity / Funds",
  "Appraisal",
  "Title",
  "Environmental / Property Condition Reports",
];

/** @type {Record<string, string[]>} */
const PRODUCT_DOCUMENTS_BY_CODE = {
  BRIDGE_LOAN: BRIDGE_DOCS,
  BRIDGE_LOAN_1_TO_4_UNITS: BRIDGE_DOCS,
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: FIX_AND_FLIP_DOCS,
  DSCR_LOAN_1_TO_4_UNITS: DSCR_DOCS,
  CONSTRUCTION_LOAN_1_TO_4_UNITS: CONSTRUCTION_1_TO_4_DOCS,
  CONSTRUCTION_LOAN: CRE_CONSTRUCTION_DOCS,
  CRE_PERMANENT_LOAN: CRE_PERMANENT_DOCS,
  CMBS: CMBS_DOCS,
  AGENCY_LOAN_MULTIFAMILY: AGENCY_MULTIFAMILY_DOCS,
  RENTAL_PORTFOLIO: RENTAL_PORTFOLIO_DOCS,
  MEZZANINE_FINANCE: MEZZANINE_PREFERRED_EQUITY_DOCS,
  PREFERRED_EQUITY: MEZZANINE_PREFERRED_EQUITY_DOCS,
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: SBA_504_DOCS,
  USDA_BI: USDA_BI_DOCS,
  EQUIPMENT_FINANCE: EQUIPMENT_FINANCE_DOCS,
  ACCOUNTS_RECEIVABLE: ACCOUNTS_RECEIVABLE_DOCS,
  ACCOUNTS_PAYABLE_FINANCE: ACCOUNTS_PAYABLE_DOCS,
  PURCHASE_ORDER_FINANCE: PURCHASE_ORDER_DOCS,
};

for (const code of SBA_7A_PRODUCT_CODES) {
  PRODUCT_DOCUMENTS_BY_CODE[code] = SBA_7A_DOCS;
}

function cleanDocName(name) {
  return String(name || "")
    .replace(/^[\s\u200B\u200C\u200D\uFEFF•\-–—⁠]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toDocumentCode(name) {
  return cleanDocName(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

async function ensureDocumentType(name) {
  const cleanedName = cleanDocName(name);
  if (!cleanedName) return null;

  const existing = await prisma.documentType.findFirst({
    where: {
      name: {
        equals: cleanedName,
        mode: "insensitive",
      },
      isCustom: false,
    },
  });

  if (existing) {
    if (!existing.isActive || !existing.code) {
      return prisma.documentType.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          code: existing.code || toDocumentCode(cleanedName),
          name: cleanedName,
        },
      });
    }
    return existing;
  }

  return prisma.documentType.create({
    data: {
      name: cleanedName,
      code: toDocumentCode(cleanedName),
      description: cleanedName,
      isCustom: false,
      isActive: true,
    },
  });
}

async function ensureProductRequirement({
  loanProduct,
  documentType,
  sortOrder,
}) {
  const existing = await prisma.productDocumentRequirement.findFirst({
    where: {
      documentTypeId: documentType.id,
      OR: [
        ...(loanProduct.id ? [{ loanProductId: loanProduct.id }] : []),
        { loanProductCode: loanProduct.code },
      ],
    },
  });

  if (existing) {
    return prisma.productDocumentRequirement.update({
      where: { id: existing.id },
      data: {
        loanProductId: loanProduct.id,
        loanProductCode: loanProduct.code,
        isRequired: true,
        minFiles: 1,
        sortOrder,
      },
    });
  }

  return prisma.productDocumentRequirement.create({
    data: {
      loanProductId: loanProduct.id,
      loanProductCode: loanProduct.code,
      documentTypeId: documentType.id,
      isRequired: true,
      minFiles: 1,
      sortOrder,
    },
  });
}

async function seedProductDocuments() {
  console.log("\n📄 Seeding product-wise admin documents...\n");

  const removedExpress = await prisma.productDocumentRequirement.deleteMany({
    where: { loanProductCode: "SBA_EXPRESS" },
  });
  if (removedExpress.count > 0) {
    console.log(
      `🧹 Removed ${removedExpress.count} SBA Express document link(s)`,
    );
  }

  const allNames = [
    ...new Set(
      Object.values(PRODUCT_DOCUMENTS_BY_CODE)
        .flat()
        .map(cleanDocName)
        .filter(Boolean),
    ),
  ];

  const documentTypeByName = new Map();
  let createdTypes = 0;
  let reusedTypes = 0;

  for (const name of allNames) {
    const before = await prisma.documentType.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        isCustom: false,
      },
      select: { id: true },
    });

    const docType = await ensureDocumentType(name);
    if (!docType) continue;

    documentTypeByName.set(name.toLowerCase(), docType);
    if (before) reusedTypes += 1;
    else createdTypes += 1;
  }

  console.log(
    `✅ Document types ready (${createdTypes} created, ${reusedTypes} reused)`,
  );

  let linked = 0;
  let skippedMissingProduct = 0;

  for (const [productCode, docNames] of Object.entries(
    PRODUCT_DOCUMENTS_BY_CODE,
  )) {
    const loanProduct = await prisma.loanProduct.findFirst({
      where: { code: productCode },
      select: { id: true, code: true, name: true },
    });

    if (!loanProduct) {
      skippedMissingProduct += 1;
      console.log(`⚠️ Loan product missing, skip docs: ${productCode}`);
      continue;
    }

    let productLinked = 0;

    for (let index = 0; index < docNames.length; index += 1) {
      const name = cleanDocName(docNames[index]);
      const documentType = documentTypeByName.get(name.toLowerCase());
      if (!documentType) continue;

      await ensureProductRequirement({
        loanProduct,
        documentType,
        sortOrder: index + 1,
      });
      productLinked += 1;
      linked += 1;
    }

    console.log(
      `✅ ${loanProduct.name} (${loanProduct.code}): ${productLinked} documents linked`,
    );
  }

  console.log(
    `\n🎉 Product documents seed complete. Links upserted: ${linked}. Missing products skipped: ${skippedMissingProduct}.`,
  );
}

module.exports = {
  seedProductDocuments,
  PRODUCT_DOCUMENTS_BY_CODE,
};

if (require.main === module) {
  seedProductDocuments()
    .catch((err) => {
      console.error("❌ Product documents seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
