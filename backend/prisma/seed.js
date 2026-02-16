const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

function section(title) {
  console.log("\n=================================================");
  console.log(`🚀 ${title}`);
  console.log("=================================================\n");
}

async function main() {
  section("STARTING CLEAN ENTERPRISE SEED");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  /* ======================================================
     1. ROLES
  ====================================================== */
  section("Creating Roles");

  const roleNames = [
    "PLATFORM_ADMIN",
    "PLATFORM_SUPPORT",
    "BROKER_ADMIN",
    "BROKER_OFFICER",
    "LENDER_ADMIN",
    "LENDER_UNDERWRITER",
    "CLIENT_USER",
  ];

  const roleMap = {};

  for (const name of roleNames) {
    const role = await prisma.role.create({
      data: { name, description: `${name} role` },
    });
    roleMap[name] = role.id;
    console.log(`✅ Role: ${name}`);
  }

  /* ======================================================
     2. PLATFORM
  ====================================================== */
  section("Creating Platform");

  const platform = await prisma.organization.create({
    data: {
      name: "LendingCart Platform",
      type: "PLATFORM",
      status: "ACTIVE",
      email: "platform@lendingcart.com",
    },
  });

  const platformAdmin = await prisma.userAccount.create({
    data: {
      email: "admin@lendingcart.com",
      passwordHash,
      firstName: "Platform",
      lastName: "Admin",
      organizationId: platform.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: platformAdmin.id,
      roleId: roleMap["PLATFORM_ADMIN"],
    },
  });

  console.log("✅ Platform + Admin Created");

  /* ======================================================
     3. LOAN PRODUCTS
  ====================================================== */
  section("Creating Loan Products");

  const loanProducts = [
    { code: "SBA_7A", name: "SBA 7A Loan" },
    { code: "CRE_PURCHASE", name: "Commercial Purchase" },
    { code: "WORKING_CAPITAL", name: "Working Capital" },
  ];

  for (const lp of loanProducts) {
    await prisma.loanProduct.create({ data: lp });
    console.log(`✅ Loan Product: ${lp.code}`);
  }

  /* ======================================================
     4. DOCUMENT TYPES
  ====================================================== */
  section("Creating Document Types");

  const docTypes = [];

  for (const code of ["BANK_STATEMENT", "TAX_RETURN", "ID_PROOF"]) {
    const dt = await prisma.documentType.create({
      data: { name: code, code },
    });
    docTypes.push(dt);
    console.log(`✅ Document Type: ${code}`);
  }

  /* ======================================================
     5. BROKERS + LOAN OFFICERS
  ====================================================== */
  section("Creating Brokers + Loan Officers");

  const brokers = [];

  for (let i = 1; i <= 3; i++) {
    const org = await prisma.organization.create({
      data: {
        name: `Broker Org ${i}`,
        type: "BROKER",
        status: "ACTIVE",
      },
    });

    // Broker Admin
    const admin = await prisma.userAccount.create({
      data: {
        email: `broker${i}@test.com`,
        passwordHash,
        firstName: "Broker",
        lastName: `Admin${i}`,
        organizationId: org.id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: roleMap["BROKER_ADMIN"],
      },
    });

    // Loan Officers
    for (let j = 1; j <= 2; j++) {
      const officer = await prisma.userAccount.create({
        data: {
          email: `broker${i}_officer${j}@test.com`,
          passwordHash,
          firstName: "Loan",
          lastName: `Officer${j}`,
          organizationId: org.id,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: officer.id,
          roleId: roleMap["BROKER_OFFICER"],
        },
      });

      console.log(`   ➜ Loan Officer ${j} created`);
    }

    await prisma.brokerWhiteLabelSetting.create({
      data: {
        brokerOrgId: org.id,
        brandName: `BrokerBrand${i}`,
        primaryColor: "#000000",
      },
    });

    await prisma.affiliateLink.create({
      data: {
        brokerOrgId: org.id,
        code: `AFFILIATE_${i}`,
        targetType: "BROKER_SIGNUP",
        commissionType: "PERCENTAGE",
        commissionValue: 5,
      },
    });

    brokers.push(org);

    console.log(`✅ Broker ${i} Created`);
  }

  /* ======================================================
     6. LENDERS + UNDERWRITERS
  ====================================================== */
  section("Creating Lenders + Underwriters");

  const lenders = [];

  for (let i = 1; i <= 3; i++) {
    const org = await prisma.organization.create({
      data: {
        name: `Lender Org ${i}`,
        type: "LENDER",
        status: "ACTIVE",
      },
    });

    const admin = await prisma.userAccount.create({
      data: {
        email: `lender${i}@test.com`,
        passwordHash,
        firstName: "Lender",
        lastName: `Admin${i}`,
        organizationId: org.id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: roleMap["LENDER_ADMIN"],
      },
    });

    for (let j = 1; j <= 2; j++) {
      const underwriter = await prisma.userAccount.create({
        data: {
          email: `lender${i}_uw${j}@test.com`,
          passwordHash,
          firstName: "Under",
          lastName: `Writer${j}`,
          organizationId: org.id,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: underwriter.id,
          roleId: roleMap["LENDER_UNDERWRITER"],
        },
      });
    }

    const lenderProduct = await prisma.lenderProduct.create({
      data: {
        lenderOrgId: org.id,
        loanProductCode: "SBA_7A",
        minLoanAmount: 50000,
        maxLoanAmount: 2000000,
      },
    });

    lenders.push({ org, lenderProduct });

    console.log(`✅ Lender ${i} Created`);
  }

  /* ======================================================
     7. CLIENTS + APPLICATIONS
  ====================================================== */
  section("Creating Clients + Applications");

  for (const broker of brokers) {
    for (let i = 1; i <= 3; i++) {
      const client = await prisma.client.create({
        data: {
          primaryBrokerOrgId: broker.id,
          legalName: `Client ${i}`,
          entityType: "COMPANY",
        },
      });

      const app = await prisma.loanApplication.create({
        data: {
          applicationNumber: `APP-${broker.id.slice(0, 4)}-${i}`,
          brokerOrgId: broker.id,
          clientId: client.id,
          loanProductCode: "SBA_7A",
          amountRequested: 250000,
        },
      });

      await prisma.applicationFinancial.create({
        data: {
          loanApplicationId: app.id,
          annualRevenue: 400000,
          netIncome: 100000,
        },
      });

      const sent = await prisma.applicationLender.create({
        data: {
          loanApplicationId: app.id,
          lenderOrgId: lenders[0].org.id,
          lenderProductId: lenders[0].lenderProduct.id,
        },
      });

      const review = await prisma.lenderReview.create({
        data: {
          applicationLenderId: sent.id,
          reviewStatus: "APPROVED",
          approvedAmount: 240000,
        },
      });

      await prisma.lenderCondition.create({
        data: {
          lenderReviewId: review.id,
          description: "Provide updated bank statement",
        },
      });

      console.log(`   ➜ Application Created`);
    }
  }

  section("SEED COMPLETED SUCCESSFULLY");

  console.log("\n🔐 Default Password For All Users:");
  console.log(PASSWORD);
}

main()
  .catch((e) => {
    console.error("❌ SEED FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });