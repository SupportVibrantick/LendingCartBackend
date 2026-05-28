// prisma/seed/documentTypes.seed.js

async function seedDocumentTypes(prisma) {
  const documentTypes = [
    // =====================================================
    // 🏢 BUSINESS DOCUMENTS
    // =====================================================
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Business Application (signed)",
      description: "Signed business loan application",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "2 Years Business Tax Returns",
      description: "Last 2 years business tax returns",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Year-to-Date Profit & Loss Statement",
      description: "Current year profit and loss statement",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Year-to-Date Balance Sheet",
      description: "Current year balance sheet",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "3 Months Business Bank Statements",
      description: "Recent 3 months business bank statements",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "6 Months Business Bank Statements",
      description: "Recent 6 months business bank statements",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "12 Months Business Bank Statements",
      description: "Recent 12 months business bank statements",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Business Debt Schedule",
      description: "Business debt schedule",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Business License / Articles of Incorporation",
      description: "Business incorporation documents",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Operating Agreement / Bylaws",
      description: "Company operating agreement or bylaws",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Entity Organizational Chart",
      description: "Business organizational chart",
    },
    {
      category: "BUSINESS_DOCUMENTS",
      name: "Business Credit Report Authorization",
      description: "Authorization for business credit report",
    },

    // =====================================================
    // 👤 PERSONAL DOCUMENTS
    // =====================================================
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Personal Financial Statement",
      description: "Borrower personal financial statement",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "2 Years Personal Tax Returns",
      description: "Last 2 years personal tax returns",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "3 Months Personal Bank Statements",
      description: "Recent 3 months personal bank statements",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Government-Issued ID (Driver's License or Passport)",
      description: "Government issued ID",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Social Security Number Authorization",
      description: "SSN authorization",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Personal Credit Report Authorization",
      description: "Authorization for personal credit report",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Resume / Bio of Key Principals",
      description: "Resume or bio of principals",
    },
    {
      category: "PERSONAL_DOCUMENTS",
      name: "Background Check Authorization",
      description: "Background verification authorization",
    },

    // =====================================================
    // 🏠 PROPERTY DOCUMENTS
    // =====================================================
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Purchase & Sale Agreement",
      description: "Purchase and sale agreement",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Current Lease Agreements (Rent Roll)",
      description: "Current rent roll and lease agreements",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Property Appraisal (Last 12 months)",
      description: "Property appraisal report",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Property Photos",
      description: "Photos of property",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Survey / Site Plan",
      description: "Survey or site plan",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Title Report / Title Commitment",
      description: "Title commitment report",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Existing Mortgage Statement",
      description: "Current mortgage statement",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Property Insurance / Binder",
      description: "Property insurance binder",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Environmental Report (Phase I)",
      description: "Environmental phase 1 report",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Environmental Report (Phase II)",
      description: "Environmental phase 2 report",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Zoning Letter / Certificate",
      description: "Zoning verification certificate",
    },
    {
      category: "PROPERTY_DOCUMENTS",
      name: "Certificate of Occupancy",
      description: "Occupancy certificate",
    },

    // =====================================================
    // 🏨 HOSPITALITY SPECIFIC
    // =====================================================
    {
      category: "HOSPITALITY_SPECIFIC",
      name: "STR / Hotel Operating Statements (3 Years)",
      description: "Hotel operating statements",
    },
    {
      category: "HOSPITALITY_SPECIFIC",
      name: "Franchise Agreement (Brand)",
      description: "Hotel franchise agreement",
    },
    {
      category: "HOSPITALITY_SPECIFIC",
      name: "Property Improvement Plan (PIP)",
      description: "Property improvement plan",
    },
    {
      category: "HOSPITALITY_SPECIFIC",
      name: "Management Agreement",
      description: "Hotel management agreement",
    },
    {
      category: "HOSPITALITY_SPECIFIC",
      name: "ADR / RevPAR / Occupancy Reports",
      description: "Hotel occupancy and revenue reports",
    },

    // =====================================================
    // 📄 ADDITIONAL / CUSTOM
    // =====================================================
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Letter of Intent (LOI)",
      description: "Letter of intent",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Executive Summary",
      description: "Executive summary",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Proof of Down Payment / Equity",
      description: "Proof of equity injection",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Gift Letter (if applicable)",
      description: "Gift letter",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Prior Year 1099s",
      description: "Prior year 1099 forms",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Accounts Receivable Aging Report",
      description: "AR aging report",
    },
    {
      category: "ADDITIONAL_CUSTOM",
      name: "Accounts Payable Aging Report",
      description: "AP aging report",
    },
  ];

  for (const doc of documentTypes) {
    const exists = await prisma.documentType.findFirst({
      where: {
        name: doc.name,
      },
    });

    if (!exists) {
      await prisma.documentType.create({
        data: {
          name: doc.name,
          description: doc.description,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${doc.name}`);
    } else {
      console.log(`⚠️ Already exists: ${doc.name}`);
    }
  }

  console.log("🎉 All Document Types Seeded Successfully");
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await seedDocumentTypes(prisma);
}

main()
  .then(async () => {
    console.log("✅ Document types seeded successfully");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

module.exports = seedDocumentTypes;
