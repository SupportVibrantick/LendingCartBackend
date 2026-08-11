/**
 * One-shot backfill: populate `LoanApplication.requestedDocumentTypes` for
 * existing loans based on the `ApplicationDocumentRequirement` rows already
 * attached to them.
 *
 * Mapping:
 *   1. Collect the distinct set of `documentTypeId` per loan.
 *   2. Look up each id's `code` from `DocumentType`.
 *   3. Reverse-map `code` → friendly wizard label using the same map as
 *      `wizardOptions.js`.
 *   4. Write `{ labels, typeIds }` back to the loan.
 *
 * Loans with no `ApplicationDocumentRequirement` rows are LEFT NULL — the
 * frontend's `fallback: true` branch handles them and renders today's
 * "show all active types" UI. Backfilling them with a synthetic list would
 * be misleading.
 *
 * Run with:  node prisma/admin/backfillRequestedDocumentTypes.js
 */
const prisma = require("../client");

// Mirror of WIZARD_LABELS in routes/common/documentTypes/wizardOptions.js.
// Keep these two in sync.
const CODE_TO_LABEL = {
  DRIVING_LICENSE: "Driving License",
  SSN_CARD: "Social Security Number Card",
  PURCHASE_AGREEMENT: "Purchase Agreement",
  FINANCIAL_STATEMENTS: "Financial Statements",
  TAX_RETURNS: "Tax Returns",
  PROFIT_AND_LOSS: "Profit & Loss",
  PROPERTY_APPRAISAL: "Property Appraisal",
  PROPERTY_TAX_BILL: "Property Tax Bill",
  CONSTRUCTION_QUOTE: "Construction Quote",
  CONSTRUCTION_PLANS: "Construction Plans",
  CONSTRUCTION_BUDGET: "Construction Budget",
  SOURCES_AND_USES: "Sources & Uses",
  PROFORMA: "Proforma",
  PERMITS_APPROVALS: "Permits & Approvals",
  CERTIFICATE_OF_OCCUPANCY: "Certificate of Occupancy",
  BANK_STATEMENTS: "Bank Statements",
  ENTITY_DOCS: "Entity Docs",
  INSURANCE_BINDER: "Insurance Binder",
  RENT_ROLL: "Rent Roll",
  PERSONAL_FINANCIAL_STATEMENT: "Personal Financial Statement",
  CREDIT_REPORT: "Credit Report",
  TITLE_REPORT: "Title Report",
  OTHER: "Other",
};

async function backfillRequestedDocumentTypes() {
  console.log("🔍 Loading existing LoanApplication rows…");

  const loans = await prisma.loanApplication.findMany({
    where: {
      // Only backfill loans that haven't been touched by the new wizard flow.
      requestedDocumentTypes: null,
    },
    select: {
      id: true,
      applicationNumber: true,
      documentRequirements: {
        select: { documentTypeId: true },
      },
    },
  });

  console.log(`📦 Found ${loans.length} loans without requestedDocumentTypes`);

  let updatedCount = 0;
  let skippedNoRowsCount = 0;
  let unresolvedCodeCount = 0;

  for (const loan of loans) {
    const distinctTypeIds = [
      ...new Set(
        (loan.documentRequirements || [])
          .map((req) => req.documentTypeId)
          .filter(Boolean),
      ),
    ];

    if (distinctTypeIds.length === 0) {
      skippedNoRowsCount++;
      continue;
    }

    const docTypes = await prisma.documentType.findMany({
      where: { id: { in: distinctTypeIds } },
      select: { id: true, code: true },
    });

    const typeIds = [];
    const labels = [];
    for (const docType of docTypes) {
      typeIds.push(docType.id);
      const label = docType.code ? CODE_TO_LABEL[docType.code] : null;
      if (label) {
        labels.push(label);
      } else {
        // No wizard vocabulary match — keep the id but no label. Frontend
        // still renders this row by name; just no friendly label.
        unresolvedCodeCount++;
      }
    }

    if (typeIds.length === 0) {
      skippedNoRowsCount++;
      continue;
    }

    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        requestedDocumentTypes: {
          labels,
          typeIds,
        },
      },
    });

    updatedCount++;
    if (updatedCount % 50 === 0) {
      console.log(`   … updated ${updatedCount} loans`);
    }
  }

  console.log("");
  console.log("✅ Backfill complete");
  console.log(`   Updated:                   ${updatedCount}`);
  console.log(`   Skipped (no requirements): ${skippedNoRowsCount}`);
  console.log(`   Codes without label map:   ${unresolvedCodeCount}`);
}

backfillRequestedDocumentTypes()
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });