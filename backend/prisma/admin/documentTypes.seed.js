// prisma/seed/documentTypes.seed.js
const prisma = require("../client");

// Each existing catalog row now gets a stable `code` so the wizard label → DB row
// mapping is exact (no more fuzzy `includes()` matching at upload time).
const documentTypes = [
  // 🏢 BUSINESS DOCUMENTS
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_APPLICATION",
    name: "Business Application (signed)",
    description: "Signed business loan application",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_TAX_RETURNS_2YR",
    name: "2 Years Business Tax Returns",
    description: "Last 2 years business tax returns",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "PROFIT_AND_LOSS_YTD",
    name: "Year-to-Date Profit & Loss Statement",
    description: "Current year profit and loss statement",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BALANCE_SHEET_YTD",
    name: "Year-to-Date Balance Sheet",
    description: "Current year balance sheet",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_BANK_STATEMENTS_3M",
    name: "3 Months Business Bank Statements",
    description: "Recent 3 months business bank statements",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_BANK_STATEMENTS_6M",
    name: "6 Months Business Bank Statements",
    description: "Recent 6 months business bank statements",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_BANK_STATEMENTS_12M",
    name: "12 Months Business Bank Statements",
    description: "Recent 12 months business bank statements",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_DEBT_SCHEDULE",
    name: "Business Debt Schedule",
    description: "Business debt schedule",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "ENTITY_DOCS",
    name: "Business License / Articles of Incorporation",
    description: "Business incorporation documents",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "OPERATING_AGREEMENT",
    name: "Operating Agreement / Bylaws",
    description: "Company operating agreement or bylaws",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "ENTITY_ORG_CHART",
    name: "Entity Organizational Chart",
    description: "Business organizational chart",
  },
  {
    category: "BUSINESS_DOCUMENTS",
    code: "BUSINESS_CREDIT_REPORT_AUTH",
    name: "Business Credit Report Authorization",
    description: "Authorization for business credit report",
  },

  // 👤 PERSONAL DOCUMENTS
  {
    category: "PERSONAL_DOCUMENTS",
    code: "PERSONAL_FINANCIAL_STATEMENT",
    name: "Personal Financial Statement",
    description: "Borrower personal financial statement",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "PERSONAL_TAX_RETURNS_2YR",
    name: "2 Years Personal Tax Returns",
    description: "Last 2 years personal tax returns",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "PERSONAL_BANK_STATEMENTS_3M",
    name: "3 Months Personal Bank Statements",
    description: "Recent 3 months personal bank statements",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "DRIVING_LICENSE",
    name: "Government-Issued ID (Driver's License or Passport)",
    description: "Government issued ID",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "SSN_AUTH",
    name: "Social Security Number Authorization",
    description: "SSN authorization",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "PERSONAL_CREDIT_REPORT_AUTH",
    name: "Personal Credit Report Authorization",
    description: "Authorization for personal credit report",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "RESUME_BIO",
    name: "Resume / Bio of Key Principals",
    description: "Resume or bio of principals",
  },
  {
    category: "PERSONAL_DOCUMENTS",
    code: "BACKGROUND_CHECK_AUTH",
    name: "Background Check Authorization",
    description: "Background verification authorization",
  },

  // 🏠 PROPERTY DOCUMENTS
  {
    category: "PROPERTY_DOCUMENTS",
    code: "PURCHASE_AGREEMENT",
    name: "Purchase & Sale Agreement",
    description: "Purchase and sale agreement",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "RENT_ROLL",
    name: "Current Lease Agreements (Rent Roll)",
    description: "Current rent roll and lease agreements",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "PROPERTY_APPRAISAL",
    name: "Property Appraisal (Last 12 months)",
    description: "Property appraisal report",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "PROPERTY_PHOTOS",
    name: "Property Photos",
    description: "Photos of property",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "SURVEY_SITE_PLAN",
    name: "Survey / Site Plan",
    description: "Survey or site plan",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "TITLE_REPORT",
    name: "Title Report / Title Commitment",
    description: "Title commitment report",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "EXISTING_MORTGAGE_STATEMENT",
    name: "Existing Mortgage Statement",
    description: "Current mortgage statement",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "INSURANCE_BINDER",
    name: "Property Insurance / Binder",
    description: "Property insurance binder",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "ENVIRONMENTAL_PHASE_I",
    name: "Environmental Report (Phase I)",
    description: "Environmental phase 1 report",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "ENVIRONMENTAL_PHASE_II",
    name: "Environmental Report (Phase II)",
    description: "Environmental phase 2 report",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "ZONING_CERTIFICATE",
    name: "Zoning Letter / Certificate",
    description: "Zoning verification certificate",
  },
  {
    category: "PROPERTY_DOCUMENTS",
    code: "CERTIFICATE_OF_OCCUPANCY",
    name: "Certificate of Occupancy",
    description: "Occupancy certificate",
  },

  // 🏨 HOSPITALITY SPECIFIC
  {
    category: "HOSPITALITY_SPECIFIC",
    code: "HOTEL_OPERATING_STATEMENTS",
    name: "STR / Hotel Operating Statements (3 Years)",
    description: "Hotel operating statements",
  },
  {
    category: "HOSPITALITY_SPECIFIC",
    code: "FRANCHISE_AGREEMENT",
    name: "Franchise Agreement (Brand)",
    description: "Hotel franchise agreement",
  },
  {
    category: "HOSPITALITY_SPECIFIC",
    code: "PROPERTY_IMPROVEMENT_PLAN",
    name: "Property Improvement Plan (PIP)",
    description: "Property improvement plan",
  },
  {
    category: "HOSPITALITY_SPECIFIC",
    code: "MANAGEMENT_AGREEMENT",
    name: "Management Agreement",
    description: "Hotel management agreement",
  },
  {
    category: "HOSPITALITY_SPECIFIC",
    code: "ADR_REVPAR_REPORTS",
    name: "ADR / RevPAR / Occupancy Reports",
    description: "Hotel occupancy and revenue reports",
  },

  // 📄 ADDITIONAL / CUSTOM
  {
    category: "ADDITIONAL_CUSTOM",
    code: "LOI",
    name: "Letter of Intent (LOI)",
    description: "Letter of intent",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "EXECUTIVE_SUMMARY",
    name: "Executive Summary",
    description: "Executive summary",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "PROOF_OF_DOWN_PAYMENT",
    name: "Proof of Down Payment / Equity",
    description: "Proof of equity injection",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "GIFT_LETTER",
    name: "Gift Letter (if applicable)",
    description: "Gift letter",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "PRIOR_YEAR_1099",
    name: "Prior Year 1099s",
    description: "Prior year 1099 forms",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "AR_AGING_REPORT",
    name: "Accounts Receivable Aging Report",
    description: "AR aging report",
  },
  {
    category: "ADDITIONAL_CUSTOM",
    code: "AP_AGING_REPORT",
    name: "Accounts Payable Aging Report",
    description: "AP aging report",
  },

  // 🏗️ CONSTRUCTION / REHAB
  {
    category: "CONSTRUCTION_REHAB",
    code: "CONSTRUCTION_BUDGET",
    name: "Detailed Construction Budget / Scope of Work",
    description: "Detailed construction budget and scope of work",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "CONTRACTOR_BIDS",
    name: "Contractor Bids / Contracts",
    description: "Contractor bids and contracts",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "CONTRACTOR_LICENSE_INSURANCE",
    name: "Contractor License & Insurance",
    description: "Contractor license and insurance documents",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "DRAW_SCHEDULE",
    name: "Draw Schedule",
    description: "Construction draw schedule",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "CONSTRUCTION_PLANS_PERMITS",
    name: "Construction Plans / Permits",
    description: "Construction plans and permits",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "AS_BUILT_APPRAISAL",
    name: "As-Built Appraisal (ARV)",
    description: "After Repair Value appraisal",
  },
  {
    category: "CONSTRUCTION_REHAB",
    code: "ARCHITECT_PLANS",
    name: "Architect Plans (if applicable)",
    description: "Architect plans and drawings",
  },

  // 🎯 WIZARD VOCABULARY (canonical 23-option list)
  // Each entry maps a wizard label (the user-facing option in Step 6 of
  // the loan application wizard) to a DocumentType row by `code`. The
  // `code` is what the wizard roundtrips end-to-end — fuzzy matching is
  // gone. Some entries intentionally share a code with a catalog row
  // above (e.g. DRIVING_LICENSE) so requests and uploads resolve to the
  // same row. Rows marked `aliasesTo: null` get a brand-new DocumentType.
  {
    category: "WIZARD_VOCAB",
    code: "DRIVING_LICENSE",
    name: "Driving License",
    aliasesTo: "DRIVING_LICENSE",
    description: "Driver's license (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "SSN_CARD",
    name: "Social Security Number Card",
    aliasesTo: "SSN_AUTH",
    description: "Social Security Number Card (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PURCHASE_AGREEMENT",
    name: "Purchase Agreement",
    aliasesTo: "PURCHASE_AGREEMENT",
    description: "Purchase & sale agreement (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "FINANCIAL_STATEMENTS",
    name: "Financial Statements",
    aliasesTo: "BALANCE_SHEET_YTD",
    description: "Year-to-date financial statements (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "TAX_RETURNS",
    name: "Tax Returns",
    aliasesTo: "PERSONAL_TAX_RETURNS_2YR",
    description: "Most recent tax returns (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PROFIT_AND_LOSS",
    name: "Profit & Loss",
    aliasesTo: "PROFIT_AND_LOSS_YTD",
    description: "Year-to-date profit & loss (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PROPERTY_APPRAISAL",
    name: "Property Appraisal",
    aliasesTo: "PROPERTY_APPRAISAL",
    description: "Property appraisal report (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PROPERTY_TAX_BILL",
    name: "Property Tax Bill",
    aliasesTo: null,
    description: "Most recent property tax bill (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "CONSTRUCTION_QUOTE",
    name: "Construction Quote",
    aliasesTo: "CONTRACTOR_BIDS",
    description: "Construction quote/bid (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "CONSTRUCTION_PLANS",
    name: "Construction Plans",
    aliasesTo: "CONSTRUCTION_PLANS_PERMITS",
    description: "Construction plans (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "CONSTRUCTION_BUDGET",
    name: "Construction Budget",
    aliasesTo: "CONSTRUCTION_BUDGET",
    description: "Construction budget (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "SOURCES_AND_USES",
    name: "Sources & Uses",
    aliasesTo: null,
    description: "Sources & uses statement (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PROFORMA",
    name: "Proforma",
    aliasesTo: null,
    description: "Proforma (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PERMITS_APPROVALS",
    name: "Permits & Approvals",
    aliasesTo: "ZONING_CERTIFICATE",
    description: "Permits and approvals (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "CERTIFICATE_OF_OCCUPANCY",
    name: "Certificate of Occupancy",
    aliasesTo: "CERTIFICATE_OF_OCCUPANCY",
    description: "Certificate of occupancy (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "BANK_STATEMENTS",
    name: "Bank Statements",
    aliasesTo: "PERSONAL_BANK_STATEMENTS_3M",
    description: "Recent bank statements (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "ENTITY_DOCS",
    name: "Entity Docs",
    aliasesTo: "ENTITY_DOCS",
    description: "Entity documents (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "INSURANCE_BINDER",
    name: "Insurance Binder",
    aliasesTo: "INSURANCE_BINDER",
    description: "Insurance binder (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "RENT_ROLL",
    name: "Rent Roll",
    aliasesTo: "RENT_ROLL",
    description: "Rent roll (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "PERSONAL_FINANCIAL_STATEMENT",
    name: "Personal Financial Statement",
    aliasesTo: "PERSONAL_FINANCIAL_STATEMENT",
    description: "Personal financial statement (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "CREDIT_REPORT",
    name: "Credit Report",
    aliasesTo: null,
    description: "Credit report (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "TITLE_REPORT",
    name: "Title Report",
    aliasesTo: "TITLE_REPORT",
    description: "Title report (wizard vocabulary)",
  },
  {
    category: "WIZARD_VOCAB",
    code: "OTHER",
    name: "Other",
    aliasesTo: null,
    description: "Other document type (wizard vocabulary)",
  },
];

// 23-option list — exported so backend routes can reference the canonical codes.
const WIZARD_DOCUMENT_TYPE_CODES = [
  "DRIVING_LICENSE",
  "SSN_CARD",
  "PURCHASE_AGREEMENT",
  "FINANCIAL_STATEMENTS",
  "TAX_RETURNS",
  "PROFIT_AND_LOSS",
  "PROPERTY_APPRAISAL",
  "PROPERTY_TAX_BILL",
  "CONSTRUCTION_QUOTE",
  "CONSTRUCTION_PLANS",
  "CONSTRUCTION_BUDGET",
  "SOURCES_AND_USES",
  "PROFORMA",
  "PERMITS_APPROVALS",
  "CERTIFICATE_OF_OCCUPANCY",
  "BANK_STATEMENTS",
  "ENTITY_DOCS",
  "INSURANCE_BINDER",
  "RENT_ROLL",
  "PERSONAL_FINANCIAL_STATEMENT",
  "CREDIT_REPORT",
  "TITLE_REPORT",
  "OTHER",
];

async function seedDocumentTypes() {
  // First pass: ensure the canonical catalog rows exist so wizard entries that
  // point at an existing row have something to land on. (Wizard entries with
  // `aliasesTo: null` create new rows in the second pass.)
  const catalogRows = documentTypes.filter((doc) => !doc.aliasesTo);
  for (const doc of catalogRows) {
    await upsertDocumentType(doc);
  }

  // Second pass: wizard vocabulary rows.
  const wizardRows = documentTypes.filter(
    (doc) => doc.category === "WIZARD_VOCAB",
  );
  for (const doc of wizardRows) {
    await upsertDocumentType(doc);
  }

  // Verify all 23 wizard codes resolve.
  const missing = await verifyWizardCodes();
  if (missing.length > 0) {
    throw new Error(
      `Wizard code verification failed — missing codes: ${missing.join(", ")}`,
    );
  }

  console.log("🎉 All Document Types Seeded Successfully");
}

async function upsertDocumentType(doc) {
  const existing = await prisma.documentType.findFirst({
    where: { code: doc.code },
  });

  if (!existing) {
    await prisma.documentType.create({
      data: {
        name: doc.name,
        code: doc.code,
        description: doc.description,
        isActive: true,
      },
    });
    console.log(`✅ Created: ${doc.name} (${doc.code})`);
    return;
  }

  // Update name/description/code so the row matches the seed definition.
  // Do NOT touch isActive — admins may have deactivated it.
  await prisma.documentType.update({
    where: { id: existing.id },
    data: {
      name: doc.name,
      code: doc.code,
      description: doc.description,
    },
  });
  console.log(`🔁 Updated: ${doc.name} (${doc.code})`);
}

async function verifyWizardCodes() {
  const rows = await prisma.documentType.findMany({
    where: { code: { in: WIZARD_DOCUMENT_TYPE_CODES }, isActive: true },
    select: { code: true, name: true },
  });
  const found = new Set(rows.map((r) => r.code));
  const missing = WIZARD_DOCUMENT_TYPE_CODES.filter((c) => !found.has(c));
  if (missing.length > 0) {
    console.error(`❌ Wizard codes missing from DB: ${missing.join(", ")}`);
  } else {
    console.log(
      `✅ All ${WIZARD_DOCUMENT_TYPE_CODES.length} wizard codes present`,
    );
  }
  return missing;
}

module.exports = {
  seedDocumentTypes,
  WIZARD_DOCUMENT_TYPE_CODES,
};
