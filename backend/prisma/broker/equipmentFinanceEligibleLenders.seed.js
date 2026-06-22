// prisma/seeds/equipment-finance-eligible-lenders.seed.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { applySchemaPatches } = require("../applySchemaPatches");

const prisma = new PrismaClient();

async function createLender({
  orgName,
  orgEmail,
  adminEmail,
  password,
  minLoanAmount,
  maxLoanAmount,
  minCreditScore,
  statesSupported,
  interestRateRange,
  minExperience,
}) {
  const role = await prisma.role.findFirst({
    where: {
      name: "LENDER_ADMIN",
    },
  });

  if (!role) {
    throw new Error("LENDER_ADMIN role not found. Seed roles first.");
  }

  const existingOrg = await prisma.organization.findFirst({
    where: {
      OR: [{ name: orgName }, { email: orgEmail }],
    },
  });

  if (existingOrg) {
    console.log(`⚠️ Skipping existing lender: ${orgName}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    // ==========================================
    // ORGANIZATION
    // ==========================================
    const lender = await tx.organization.create({
      data: {
        name: orgName,
        email: orgEmail,
        type: "LENDER",
        status: "ACTIVE",
      },
    });

    // ==========================================
    // ADMIN USER
    // ==========================================
    const adminUser = await tx.userAccount.create({
      data: {
        organizationId: lender.id,
        email: adminEmail,
        passwordHash,
        firstName: "Lender",
        lastName: "Admin",
        status: "ACTIVE",
      },
    });

    // ==========================================
    // ROLE
    // ==========================================
    await tx.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: role.id,
      },
    });

    // ==========================================
    // LENDER PROFILE
    // ==========================================
    await tx.lenderProfile.create({
      data: {
        lenderOrgId: lender.id,
        summary:
          "Equipment financing lender specializing in commercial equipment funding.",
        loanTypes: ["EQUIPMENT_FINANCE"],
        minFunding: minLoanAmount,
        maxFunding: maxLoanAmount,
        statesSupported,
        industries: "Construction, Manufacturing, Transportation",
        fundingSpeedDays: 5,
        profileStatus: "COMPLETED",
        isVisible: true,
      },
    });

    // ==========================================
    // LENDER PRODUCT
    // ==========================================
    const equipmentFinanceProduct = await tx.loanProduct.findFirst({
      where: { code: "EQUIPMENT_FINANCE" },
    });

    if (!equipmentFinanceProduct) {
      throw new Error(
        "EQUIPMENT_FINANCE loan product not found. Run admin loan product seed first.",
      );
    }

    await tx.lenderProduct.create({
      data: {
        lenderOrgId: lender.id,
        loanProductId: equipmentFinanceProduct.id,
        loanProductCode: "EQUIPMENT_FINANCE",

        propertyTypes: ["MULTIFAMILY"],

        minLoanAmount,
        maxLoanAmount,

        minTermMonths: 6,
        maxTermMonths: 60,

        minCreditScore,

        minExperience,

        statesSupported,

        interestRateRange,

        isActive: true,
      },
    });

    console.log(`✅ Created lender: ${orgName}`);
  });
}

async function main() {
  console.log("🚀 Seeding Equipment Finance Eligible Lenders...");

  await applySchemaPatches(prisma);

  await createLender({
    orgName: "Equipment Finance Prime",
    orgEmail: "prime@lender.com",
    adminEmail: "admin.prime@lender.com",
    password: "Password@123",
    minLoanAmount: 100000,
    maxLoanAmount: 3000000,
    minCreditScore: 300,
    statesSupported: "Arizona,Texas,Florida",
    interestRateRange: "8-12%",
    minExperience: "1",
  });

  await createLender({
    orgName: "Equipment Growth Capital",
    orgEmail: "growth@lender.com",
    adminEmail: "admin.growth@lender.com",
    password: "Password@123",
    minLoanAmount: 500000,
    maxLoanAmount: 5000000,
    minCreditScore: 340,
    statesSupported: "Arizona",
    interestRateRange: "9-13%",
    minExperience: "2",
  });

  await createLender({
    orgName: "Equipment Funding Direct",
    orgEmail: "direct@lender.com",
    adminEmail: "admin.direct@lender.com",
    password: "Password@123",
    minLoanAmount: 750000,
    maxLoanAmount: 10000000,
    minCreditScore: 350,
    statesSupported: "Arizona,Nevada",
    interestRateRange: "10-14%",
    minExperience: "3",
  });

  console.log("🎉 Equipment Finance Eligible Lenders Seeded Successfully");
}

main()
  .catch((error) => {
    console.error("❌ Seed Failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
