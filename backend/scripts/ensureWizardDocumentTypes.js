const { PrismaClient } = require("@prisma/client");
const { seedDocumentTypes } = require("../prisma/admin/documentTypes.seed");

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedDocumentTypes();

    const wizard = [
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
    const found = await prisma.documentType.findMany({
      where: { code: { in: wizard }, isActive: true },
      select: { code: true, name: true },
    });
    const set = new Set(found.map((r) => r.code));
    const missing = wizard.filter((c) => !set.has(c));
    console.log("wizard codes present:", found.length);
    console.log("still missing:", missing);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
