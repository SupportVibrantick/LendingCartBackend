// backend/routes/common/documentTypes/wizardOptions.js
const { WIZARD_DOCUMENT_TYPE_CODES } = require("../../../prisma/admin/documentTypes.seed");

module.exports = async function wizardDocumentTypeOptions(fastify) {
  fastify.get(
    "/wizard-options",
    {
      schema: {
        tags: ["Common -> Document Types"],
        summary:
          "Get the canonical 23-option document-type list used by the loan-application wizard (Step 6). Each entry is keyed by `code` and includes a friendly `label` plus the DB row's `id` and `name`.",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      await fastify.authenticate(req, reply);

      const rows = await prisma.documentType.findMany({
        where: {
          code: { in: WIZARD_DOCUMENT_TYPE_CODES },
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      });

      // Stable order matching the wizard's vocabulary so the UI renders
      // checkboxes in the same order regardless of DB insertion sequence.
      const byCode = new Map(rows.map((row) => [row.code, row]));
      const ordered = WIZARD_DOCUMENT_TYPE_CODES
        .map((code) => {
          const row = byCode.get(code);
          if (!row) return null;
          return {
            id: row.id,
            code: row.code,
            // Friendly label comes from the canonical wizard list (above the
            // seed). For rows the seed aliases back to an existing catalog
            // row, the wizard label and DB `name` differ by design — we
            // surface `name` for display but expose `code` for routing.
            label: wizardLabelFor(code),
            name: row.name,
            description: row.description,
          };
        })
        .filter(Boolean);

      return {
        success: true,
        data: ordered,
      };
    },
  );
};

// Keep this map in sync with `APPLICATION_DOCUMENT_TYPE_OPTIONS` in the
// frontends (broker-dashboard + loan-application-embeded). The DB stores the
// `code`; the wizard UI shows the human-friendly label.
const WIZARD_LABELS = {
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

function wizardLabelFor(code) {
  return WIZARD_LABELS[code] || code;
}