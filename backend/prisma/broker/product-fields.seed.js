// prisma/seed/product-fields.seed.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * =========================================================
 * STATIC FIELDS (ALREADY PRESENT IN UI)
 * =========================================================
 */

const STATIC_FIELD_KEYS = [
  "purpose",
  "amount",
  "interestRate",
  "currentMarketValue",
  "purchasePrice",
  "purchaseDate",
  "afterRepairValue",
  "totalAssets",
  "totalLiabilities",
  "propertyType",
  "subPropertyType",
  "recourse",
  "businessAddress",
  "city",
  "state",
  "zip",
  "loanTerm",
  "monthlyRent",
  "grossRevenueActual",
  "grossRevenueProforma",
  "noiActual",
  "noiProforma",
  "annualTaxes",
  "floodZone",
  "insurancePremium",
  "hoaDues",
  "name",
  "entityName",
  "phone",
  "email",
  "employer",
  "dob",
  "ssn",
  "creditScore",
  "address",
  "mailingAddress",
  "legalName",
  "entityType",
  "dba",
  "formationDate",
  "yearsInBusiness",
];

/**
 * =========================================================
 * PRODUCT SPECIFIC DYNAMIC FIELDS
 * =========================================================
 */

const PRODUCT_FIELDS = [
  /**
   * ======================================================
   * SBA 7A EQUIPMENT
   * ======================================================
   */
  {
    productCode: "SBA_7A_EQUIPMENT_PURCHASE",
    fields: [
      {
        fieldKey: "equipmentType",
        label: "Equipment Type",
        type: "SELECT",
        options: [
          "Medical Equipment",
          "Construction Equipment",
          "Restaurant Equipment",
          "Manufacturing Equipment",
          "Technology Equipment",
          "Office Equipment",
        ],
        required: true,
        sectionName: "Equipment Details",
      },

      {
        fieldKey: "equipmentCost",
        label: "Equipment Cost",
        type: "NUMBER",
        required: true,
        sectionName: "Equipment Details",
      },

      {
        fieldKey: "vendorName",
        label: "Vendor Name",
        type: "TEXT",
        required: true,
        sectionName: "Equipment Details",
      },

      {
        fieldKey: "downPayment",
        label: "Down Payment",
        type: "NUMBER",
        required: false,
        sectionName: "Equipment Details",
      },
    ],
  },

  /**
   * ======================================================
   * DSCR
   * ======================================================
   */
  {
    productCode: "DSCR_LOAN_1_TO_4_UNITS",
    fields: [
      {
        fieldKey: "occupancyStatus",
        label: "Occupancy Status",
        type: "SELECT",
        options: ["Tenant Occupied", "Vacant", "Owner Occupied"],
        required: true,
        sectionName: "DSCR Details",
      },

      {
        fieldKey: "leaseTermMonths",
        label: "Lease Term (Months)",
        type: "NUMBER",
        required: false,
        sectionName: "DSCR Details",
      },

      {
        fieldKey: "propertyCondition",
        label: "Property Condition",
        type: "SELECT",
        options: ["Excellent", "Good", "Average", "Needs Rehab"],
        required: true,
        sectionName: "DSCR Details",
      },
    ],
  },

  /**
   * ======================================================
   * FIX & FLIP
   * ======================================================
   */
  {
    productCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    fields: [
      {
        fieldKey: "rehabBudget",
        label: "Rehab Budget",
        type: "NUMBER",
        required: true,
        sectionName: "Rehab Details",
      },

      {
        fieldKey: "experienceProjects",
        label: "Completed Flip Projects",
        type: "NUMBER",
        required: true,
        sectionName: "Experience",
      },

      {
        fieldKey: "exitStrategy",
        label: "Exit Strategy",
        type: "SELECT",
        options: ["Sell", "Refinance", "Hold"],
        required: true,
        sectionName: "Exit Strategy",
      },
    ],
  },

  /**
   * ======================================================
   * CONSTRUCTION
   * ======================================================
   */
  {
    productCode: "CONSTRUCTION_LOAN",
    fields: [
      {
        fieldKey: "constructionType",
        label: "Construction Type",
        type: "SELECT",
        options: [
          "Ground Up",
          "Renovation",
          "Expansion",
          "Tenant Improvement",
        ],
        required: true,
        sectionName: "Construction",
      },

      {
        fieldKey: "constructionBudget",
        label: "Construction Budget",
        type: "NUMBER",
        required: true,
        sectionName: "Construction",
      },

      {
        fieldKey: "builderExperience",
        label: "Builder Experience (Years)",
        type: "NUMBER",
        required: true,
        sectionName: "Construction",
      },

      {
        fieldKey: "permitsApproved",
        label: "Permits Approved",
        type: "RADIO",
        options: ["Yes", "No"],
        required: true,
        sectionName: "Construction",
      },
    ],
  },

  /**
   * ======================================================
   * PURCHASE ORDER FINANCE
   * ======================================================
   */
  {
    productCode: "PURCHASE_ORDER_FINANCE",
    fields: [
      {
        fieldKey: "poAmount",
        label: "PO Amount",
        type: "NUMBER",
        required: true,
        sectionName: "PO Details",
      },

      {
        fieldKey: "buyerName",
        label: "Buyer Name",
        type: "TEXT",
        required: true,
        sectionName: "PO Details",
      },

      {
        fieldKey: "supplierName",
        label: "Supplier Name",
        type: "TEXT",
        required: true,
        sectionName: "PO Details",
      },

      {
        fieldKey: "internationalTransaction",
        label: "International Transaction",
        type: "RADIO",
        options: ["Yes", "No"],
        required: true,
        sectionName: "PO Details",
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding product fields...");

  for (const product of PRODUCT_FIELDS) {
    const loanProduct = await prisma.loanProduct.findFirst({
      where: {
        code: product.productCode,
      },
    });

    if (!loanProduct) {
      console.log(`❌ Product not found: ${product.productCode}`);
      continue;
    }

    /**
     * ======================================================
     * GROUP FIELDS BY SECTION
     * ======================================================
     */

    const sectionsMap = {};

    for (const field of product.fields) {
      if (STATIC_FIELD_KEYS.includes(field.fieldKey)) {
        console.log(
          `⚠️ Skipped duplicate static field: ${field.fieldKey}`,
        );
        continue;
      }

      if (!sectionsMap[field.sectionName]) {
        sectionsMap[field.sectionName] = [];
      }

      sectionsMap[field.sectionName].push(field);
    }

    /**
     * ======================================================
     * CREATE SECTIONS
     * ======================================================
     */

    for (const [sectionName, fields] of Object.entries(sectionsMap)) {
      let section = await prisma.loanApplicationSection.findFirst({
        where: {
          productId: loanProduct.id,
          sectionName,
        },
      });

      if (!section) {
        section = await prisma.loanApplicationSection.create({
          data: {
            productId: loanProduct.id,
            sectionName,
            sortOrder: 1,
          },
        });
      }

      /**
       * ======================================================
       * CREATE FIELDS
       * ======================================================
       */

      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];

        const existingField =
          await prisma.loanApplicationField.findFirst({
            where: {
              sectionId: section.id,
              fieldKey: field.fieldKey,
            },
          });

        if (existingField) {
          console.log(`⚠️ Duplicate skipped: ${field.fieldKey}`);
          continue;
        }

        await prisma.loanApplicationField.create({
          data: {
            sectionId: section.id,
            fieldKey: field.fieldKey,
            label: field.label,
            type: field.type,
            placeholder: field.label,
            required: field.required,
            options: field.options || [],
            sortOrder: i + 1,
          },
        });

        console.log(
          `✅ Added field: ${field.fieldKey} → ${product.productCode}`,
        );
      }
    }
  }

  console.log("✅ Product field seeding completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });