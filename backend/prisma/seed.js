const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 DEV SEED STARTED...\n");

  /* ==========================================================
     1️⃣ ENSURE LOAN PRODUCT EXISTS
  ========================================================== */

  let loanProduct = await prisma.loanProduct.findFirst({
    where: { code: "SBA_7A" },
  });

  if (!loanProduct) {
    loanProduct = await prisma.loanProduct.create({
      data: {
        code: "SBA_7A",
        name: "SBA 7A Loan",
        description: "Government backed SBA loan product",
      },
    });
    console.log("✅ Loan Product Created");
  } else {
    console.log("✅ Loan Product Already Exists");
  }

  /* ==========================================================
     2️⃣ GET BROKER ORG (FROM YOUR MAIN SEED)
  ========================================================== */

  const brokerOrg = await prisma.organization.findFirst({
    where: { type: "BROKER", isDeleted: false },
  });

  if (!brokerOrg) {
    throw new Error("❌ No broker found. Run enterprise seed first.");
  }

  console.log("✅ Broker Found:", brokerOrg.name);

  /* ==========================================================
     3️⃣ CREATE BROKER APPLICATION
  ========================================================== */

  const brokerApplication = await prisma.brokerApplication.create({
    data: {
      brokerOrgId: brokerOrg.id,
      name: "SBA Application Form",
      code: `SBA_FORM_${Date.now()}`,
      isActive: true,
    },
  });

  console.log("✅ Broker Application Created");

  /* ==========================================================
     4️⃣ LINK PRODUCT TO APPLICATION
  ========================================================== */

  const appProduct = await prisma.brokerApplicationProduct.create({
    data: {
      brokerApplicationId: brokerApplication.id,
      loanProductCode: "SBA_7A",
      isActive: true,
    },
  });

  console.log("✅ Application Product Created");

  /* ==========================================================
     5️⃣ CREATE SECTIONS
  ========================================================== */

  const businessSection = await prisma.brokerApplicationSection.create({
    data: {
      applicationProductId: appProduct.id,
      name: "Business Info",
      sortOrder: 1,
    },
  });

  const financialSection = await prisma.brokerApplicationSection.create({
    data: {
      applicationProductId: appProduct.id,
      name: "Financial Info",
      sortOrder: 2,
    },
  });

  console.log("✅ Sections Created");

  /* ==========================================================
     6️⃣ CREATE FIELDS
  ========================================================== */

  const fields = await prisma.$transaction([
    prisma.brokerApplicationProductField.create({
      data: {
        applicationProductId: appProduct.id,
        sectionId: businessSection.id,
        fieldKey: "businessName",
        label: "Business Name",
        fieldType: "TEXT",
        isRequired: true,
        sortOrder: 1,
      },
    }),
    prisma.brokerApplicationProductField.create({
      data: {
        applicationProductId: appProduct.id,
        sectionId: businessSection.id,
        fieldKey: "yearsInBusiness",
        label: "Years in Business",
        fieldType: "NUMBER",
        isRequired: true,
        sortOrder: 2,
      },
    }),
    prisma.brokerApplicationProductField.create({
      data: {
        applicationProductId: appProduct.id,
        sectionId: financialSection.id,
        fieldKey: "annualRevenue",
        label: "Annual Revenue",
        fieldType: "CURRENCY",
        isRequired: true,
        sortOrder: 1,
      },
    }),
  ]);

  console.log("✅ Fields Created");

  /* ==========================================================
     7️⃣ CREATE CLIENT
  ========================================================== */

  const client = await prisma.client.create({
    data: {
      primaryBrokerOrgId: brokerOrg.id,
      legalName: "Dev Test Company LLC",
      entityType: "COMPANY",
    },
  });

  console.log("✅ Client Created");

  /* ==========================================================
     8️⃣ CREATE LOAN APPLICATION
  ========================================================== */

  const loanApplication = await prisma.loanApplication.create({
    data: {
      applicationNumber: `DEV-${Date.now()}`,
      brokerOrgId: brokerOrg.id,
      clientId: client.id,
      loanProductCode: "SBA_7A",
      status: "SUBMITTED",
      amountRequested: 250000,
      termMonthsRequested: 120,
      submittedAt: new Date(),
    },
  });

  console.log("✅ Loan Application Created");

  /* ==========================================================
     9️⃣ CREATE SUBMISSION
  ========================================================== */

  const submission = await prisma.applicationSubmission.create({
    data: {
      applicationId: loanApplication.id,
      applicationProductId: appProduct.id,
      status: "SUBMITTED",
    },
  });

  console.log("✅ Submission Created");

  /* ==========================================================
     🔟 INSERT SUBMISSION VALUES
  ========================================================== */

  await prisma.$transaction([
    prisma.applicationSubmissionField.create({
      data: {
        submissionId: submission.id,
        fieldId: fields[0].id,
        fieldKey: "businessName",
        value: { text: "Dev Test Company LLC" },
        source: "BROKER",
      },
    }),
    prisma.applicationSubmissionField.create({
      data: {
        submissionId: submission.id,
        fieldId: fields[1].id,
        fieldKey: "yearsInBusiness",
        value: 5,
        source: "BROKER",
      },
    }),
    prisma.applicationSubmissionField.create({
      data: {
        submissionId: submission.id,
        fieldId: fields[2].id,
        fieldKey: "annualRevenue",
        value: 800000,
        source: "BROKER",
      },
    }),
  ]);

  console.log("✅ Submission Data Inserted");

  console.log("\n🎉 DEV SEED COMPLETED SUCCESSFULLY");
}

main()
  .catch((e) => {
    console.error("❌ ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });