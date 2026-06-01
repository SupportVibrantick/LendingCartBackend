// prisma/broker/applicationSubmission.seed.js

const { randomUUID } = require("crypto");
const prisma = require("../client");

async function seedApplicationSubmission() {
  console.log("🚀 Seeding Application Submission...");

  const brokerOrg = await prisma.organization.findFirst({
    where: { type: "BROKER" },
  });

  if (!brokerOrg) {
    throw new Error("Broker organization not found");
  }

  const applicationProduct = await prisma.brokerApplicationProduct.findFirst({
    where: {
      loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    },
  });

  if (!applicationProduct) {
    throw new Error(
      "FIX_AND_FLIP_LOAN_1_TO_4_UNITS application product not found",
    );
  }

const client = await prisma.client.create({
  data: {
    primaryBrokerOrgId: brokerOrg.id,
    legalName: "Applicant",
    entityType: "INDIVIDUAL",
  },
});

  if (!client) {
    client = await prisma.client.create({
      data: {
        id: randomUUID(),
        legalName: "Tushar Jain",
        entityType: "INDIVIDUAL",
        primaryBrokerOrgId: brokerOrg.id,
      },
    });
  }

  const loanApplication = await prisma.loanApplication.create({
    data: {
      id: randomUUID(),
      applicationNumber: `APP-${Date.now()}`,
      brokerOrgId: brokerOrg.id,
      clientId: client.id,
      loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
      status: "DRAFT",
    },
  });

  const submission = await prisma.applicationSubmission.create({
    data: {
      applicationId: loanApplication.id,
      applicationProductId: applicationProduct.id,
      status: "CLIENT_PENDING",
    },
  });

  const fields = [
    ["borrowerFirstName", "Tushar"],
    ["borrowerLastName", "Jain"],
    ["companyName", "VIB"],
    ["email", "tusharjain61451@gmail.com"],
    ["phone", "467-676-7676"],
    ["creditScore", "340"],
    ["borrowerCity", "Mohali"],
    ["borrowerState", "Indiana"],
    ["borrowerCountry", "USA"],
    ["dob", "2026-01-01"],
    ["ssn", "455-45-4656"],
    ["address", "Mohali, Sector 74"],
    ["employer", "Employer"],

    ["loanProductCode", "FIX_AND_FLIP_LOAN_1_TO_4_UNITS"],
    ["amountRequested", "1000000"],
    ["interestRate", "8"],
    ["purpose", "Purchase & Rehab"],

    ["propertyType", "RETAIL"],
    ["subPropertyType", "Single-Tenant"],
    ["recourse", "FULL_RECOURSE"],

    ["propertyAddress", "123 Main Steet"],
    ["propertyCity", "Chandigarh"],
    ["propertyState", "Maine"],
    ["propertyZip", "232323323"],
    ["propertyCountry", "USA"],

    ["loanTerm", "12"],

    ["noiActual", "34000000"],

    ["entityLegalName", "Business"],
    ["entityType", "CORP"],
    ["dba", "dba"],

    ["formationDate", "2026-01-01"],
    ["yearsInBusiness", "4"],

    ["currentMarketValue", "1500000"],
    ["afterRepairValue", "2000000"],
    ["purchasePrice", "1200000"],
    ["purchaseDate", "2026-01-01"],

    ["totalAssets", "120000"],
    ["totalLiabilities", "1001"],

    ["monthlyRent", "1200000"],
    ["grossRevenueActual", "1300000"],
    ["grossRevenueProforma", "1400000"],
    ["noiProforma", "4"],

    ["annualTaxes", "4343444"],
    ["insurancePremium", "343000"],
    ["hoaDues", "565600000"],

    ["rehabBudget", "4400000"],
    ["estimatedRepairMonths", "4"],
    ["exitStrategy", "Exit"],

    ["ltvPercentage", "66.67"],
    ["ltcPercentage", "83.33"],
    ["arvPercentage", "50"],

    ["dscr", "390.86"],
    ["netWorth", "118999"],
  ];

  await prisma.applicationSubmissionField.createMany({
    data: fields.map(([fieldKey, value]) => ({
      submissionId: submission.id,
      fieldKey,
      value: String(value),
      source: "STATIC",
    })),
  });

  console.log("✅ Application Submission Seeded");
  console.log("Submission ID:", submission.id);
}

module.exports = {
  seedApplicationSubmission,
};
