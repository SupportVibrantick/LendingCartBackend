const { randomUUID } = require("crypto");
const prisma = require("../client");
const { BROKER_ORG_NAME, BROKER_EMAIL } = require("../seedConfig");

const SEED_APPLICATION_NUMBER =
  process.env.SEED_LOAN_APP_NUMBER || "APP-SEED-FIX-FLIP-001";

const SEED_CLIENT_EMAIL =
  process.env.SEED_LOAN_APP_EMAIL || "tusharjain61451@gmail.com";

const LOAN_PRODUCT_CODE = "FIX_AND_FLIP_LOAN_1_TO_4_UNITS";

const SUBMISSION_FIELDS = [
  { fieldKey: "borrowerFirstName", value: "Tushar" },
  { fieldKey: "borrowerLastName", value: "Jain" },
  { fieldKey: "companyName", value: "VIS" },
  { fieldKey: "email", value: SEED_CLIENT_EMAIL },
  { fieldKey: "phone", value: "343-434-3434" },
  { fieldKey: "creditScore", value: "340" },
  { fieldKey: "borrowerCity", value: "Mohali" },
  { fieldKey: "borrowerState", value: "Iowa" },
  { fieldKey: "borrowerCountry", value: "USA" },
  { fieldKey: "dob", value: "2026-01-01" },
  { fieldKey: "ssn", value: "343-43-4343" },
  { fieldKey: "address", value: "Mohali, Sector 74" },
  { fieldKey: "employer", value: "Employer" },
  { fieldKey: "loanProductCode", value: LOAN_PRODUCT_CODE },
  { fieldKey: "amountRequested", value: 1000000 },
  { fieldKey: "interestRate", value: "8" },
  { fieldKey: "purpose", value: "Purchase & Rehab" },
  { fieldKey: "propertyType", value: "MULTIFAMILY" },
  { fieldKey: "subPropertyType", value: "Garden" },
  { fieldKey: "recourse", value: "FULL_RECOURSE" },
  { fieldKey: "propertyAddress", value: "123 Main Street" },
  { fieldKey: "propertyCity", value: "Chandigarh" },
  { fieldKey: "propertyState", value: "Iowa" },
  { fieldKey: "propertyZip", value: "343434343" },
  { fieldKey: "propertyCountry", value: "USA" },
  { fieldKey: "loanTerm", value: "12" },
  { fieldKey: "noiActual", value: "400,008,766" },
  { fieldKey: "entityLegalName", value: "Business" },
  { fieldKey: "entityType", value: "PARTNERSHIP" },
  { fieldKey: "dba", value: "dba" },
  { fieldKey: "formationDate", value: "2026-12-01" },
  { fieldKey: "yearsInBusiness", value: "2" },
  { fieldKey: "currentMarketValue", value: 1500000 },
  { fieldKey: "afterRepairValue", value: 2000000 },
  { fieldKey: "purchasePrice", value: 1200000 },
  { fieldKey: "purchaseDate", value: "2026-01-01" },
  { fieldKey: "totalAssets", value: 340000 },
  { fieldKey: "totalLiabilities", value: 110000 },
  { fieldKey: "monthlyRent", value: "1,200,000" },
  { fieldKey: "grossRevenueActual", value: "4,400,000" },
  { fieldKey: "grossRevenueProforma", value: "4,500,000" },
  { fieldKey: "noiProforma", value: "3" },
  { fieldKey: "annualTaxes", value: "1,200,000" },
  { fieldKey: "insurancePremium", value: "130,000" },
  { fieldKey: "hoaDues", value: "5,655,555" },
  { fieldKey: "rehabBudget", value: "1200000" },
  { fieldKey: "estimatedRepairMonths", value: "4" },
  { fieldKey: "exitStrategy", value: "exit" },
  { fieldKey: "ltvPercentage", value: 66.67 },
  { fieldKey: "ltcPercentage", value: 83.33 },
  { fieldKey: "arvPercentage", value: 50 },
  { fieldKey: "dscr", value: 4598.41 },
  { fieldKey: "netWorth", value: 230000 },
];

function getFieldValue(fieldKey) {
  const field = SUBMISSION_FIELDS.find((item) => item.fieldKey === fieldKey);
  return field?.value ?? null;
}

async function resolveBuilderFieldMap(applicationProductId) {
  const builderFields = await prisma.brokerApplicationProductField.findMany({
    where: { applicationProductId },
    select: { id: true, fieldKey: true },
  });

  return new Map(builderFields.map((field) => [field.fieldKey, field.id]));
}

async function seedLoanApplication() {
  console.log("🚀 Seeding Loan Application...");

  const brokerOrgName = BROKER_ORG_NAME;
  const brokerEmail = BROKER_EMAIL;

  const loanOfficerEmail =
    process.env.SEED_LO_OFFICER_1_EMAIL || "sarah.mitchell@demo-broker.com";

  let organization = await prisma.organization.findFirst({
    where: { name: brokerOrgName, type: "BROKER" },
  });

  if (!organization) {
    organization = await prisma.organization.findFirst({
      where: { type: "BROKER" },
    });
  }

  if (!organization) {
    throw new Error("Broker organization not found");
  }

  const brokerUser = await prisma.userAccount.findUnique({
    where: { email: brokerEmail },
  });

  const loanOfficer = await prisma.userAccount.findUnique({
    where: { email: loanOfficerEmail },
  });

  const assignedOfficer = loanOfficer || brokerUser;

  const applicationProduct = await prisma.brokerApplicationProduct.findFirst({
    where: {
      loanProductCode: LOAN_PRODUCT_CODE,
      isActive: true,
      brokerApplication: {
        isActive: true,
        brokerOrgId: organization.id,
      },
    },
  });

  if (!applicationProduct) {
    throw new Error(
      `${LOAN_PRODUCT_CODE} application product not found. Run seedApplicationBuilder first.`,
    );
  }

  const existingApplication = await prisma.loanApplication.findUnique({
    where: { applicationNumber: SEED_APPLICATION_NUMBER },
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (existingApplication) {
    if (loanOfficer && existingApplication.brokerUserId !== loanOfficer.id) {
      await prisma.loanApplication.update({
        where: { id: existingApplication.id },
        data: { brokerUserId: loanOfficer.id },
      });
      console.log(`✅ Loan application reassigned to LO: ${loanOfficerEmail}`);
    }

    console.log(
      `ℹ️ Loan application already exists: ${existingApplication.applicationNumber}`,
    );
    console.log("Application ID:", existingApplication.id);
    if (existingApplication.submissions[0]) {
      console.log("Submission ID:", existingApplication.submissions[0].id);
    }

    const { seedLoanMessaging } = require("./loanMessaging.seed");
    await seedLoanMessaging(existingApplication.id);

    return existingApplication;
  }

  const firstName = getFieldValue("borrowerFirstName") || "Tushar";
  const lastName = getFieldValue("borrowerLastName") || "Jain";
  const email = getFieldValue("email");

  let client = await prisma.client.findFirst({
    where: {
      primaryBrokerOrgId: organization.id,
      contacts: {
        some: { email },
      },
    },
    include: { contacts: true },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        id: randomUUID(),
        legalName: `${firstName} ${lastName}`.trim(),
        entityType: "INDIVIDUAL",
        primaryBrokerOrgId: organization.id,
        contacts: {
          create: {
            firstName,
            lastName,
            email,
            phone: getFieldValue("phone"),
            isPrimary: true,
          },
        },
      },
    });

    console.log(`✅ Client created: ${client.legalName}`);
  } else {
    console.log(`ℹ️ Client already exists: ${client.legalName}`);
  }

  const amountRequested = getFieldValue("amountRequested");
  const loanTerm = getFieldValue("loanTerm");
  const purpose = getFieldValue("purpose");

  const loanApplication = await prisma.loanApplication.create({
    data: {
      applicationNumber: SEED_APPLICATION_NUMBER,
      brokerOrgId: organization.id,
      brokerUserId: assignedOfficer?.id ?? null,
      clientId: client.id,
      loanProductCode: LOAN_PRODUCT_CODE,
      status: "DRAFT",
      amountRequested,
      termMonthsRequested: loanTerm ? Number(loanTerm) : null,
      purpose,
    },
  });

  const submission = await prisma.applicationSubmission.create({
    data: {
      applicationId: loanApplication.id,
      applicationProductId: applicationProduct.id,
      status: "CLIENT_PENDING",
    },
  });

  const builderFieldMap = await resolveBuilderFieldMap(applicationProduct.id);

  await prisma.applicationSubmissionField.createMany({
    data: SUBMISSION_FIELDS.map(({ fieldKey, value }) => ({
      submissionId: submission.id,
      fieldId: builderFieldMap.get(fieldKey) ?? null,
      fieldKey,
      value,
      source: builderFieldMap.has(fieldKey) ? "DYNAMIC" : "STATIC",
    })),
  });

  console.log("✅ Loan application seeded");
  console.log("Application ID:", loanApplication.id);
  console.log("Application Product ID:", applicationProduct.id);
  console.log("Submission ID:", submission.id);
  console.log("Client ID:", client.id);

  const { seedLoanMessaging } = require("./loanMessaging.seed");
  await seedLoanMessaging(loanApplication.id);

  return {
    loanApplication,
    submission,
    client,
    applicationProduct,
  };
}

module.exports = {
  seedLoanApplication,
};
