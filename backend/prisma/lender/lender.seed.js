const bcrypt = require("bcrypt");
const prisma = require("../client");

async function seedLenderUser() {
const lenderEmail =
  process.env.SEED_LENDER_EMAIL || "lender@lendingcart.com";

const lenderPassword =
  process.env.SEED_LENDER_PASSWORD || "Lender@123";
  
  const lenderOrgName =
    process.env.SEED_LENDER_ORG_NAME || "Demo Lender";

  const organization = await prisma.organization.findFirst({
    where: {
      name: lenderOrgName,
    },
  });

  if (!organization) {
    throw new Error(
      `Lender organization not found: ${lenderOrgName}`
    );
  }

  const role = await prisma.role.findFirst({
    where: {
      name: "LENDER_ADMIN",
    },
  });

  if (!role) {
    throw new Error("LENDER_ADMIN role not found");
  }

  const passwordHash = await bcrypt.hash(
    lenderPassword,
    12
  );

  let lenderUser = await prisma.userAccount.findUnique({
    where: {
      email: lenderEmail,
    },
  });

  if (!lenderUser) {
    lenderUser = await prisma.userAccount.create({
      data: {
        organizationId: organization.id,
        email: lenderEmail,
        passwordHash,
        firstName: "Lender",
        lastName: "Admin",
        status: "ACTIVE",
      },
    });

    console.log(
      `✅ Lender user created: ${lenderUser.email}`
    );
  } else {
    console.log(
      `ℹ️ Lender user already exists: ${lenderUser.email}`
    );
  }

  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: lenderUser.id,
      roleId: role.id,
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: lenderUser.id,
        roleId: role.id,
      },
    });

    console.log("✅ LENDER_ADMIN role assigned");
  } else {
    console.log("ℹ️ LENDER_ADMIN role already assigned");
  }

  const existingProfile = await prisma.lenderProfile.findFirst({
  where: {
    lenderOrgId: organization.id,
  },
});

if (!existingProfile) {
  await prisma.lenderProfile.create({
    data: {
      lenderOrgId: organization.id,
      summary: "Demo Fix and Flip Lender",
      loanTypes: ["FIX_AND_FLIP_LOAN_1_TO_4_UNITS"],
      minFunding: 500000,
      maxFunding: 3000000,
      statesSupported: "Iowa,Texas,Florida",
      industries: "Real Estate",
      fundingSpeedDays: 5,
      profileStatus: "COMPLETED",
      isVisible: true,
    },
  });
}

  // Existing lender create

const loanProduct = await prisma.loanProduct.findFirst({
  where: {
    code: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
  },
});

if (!loanProduct) {
  throw new Error(
    "Loan product FIX_AND_FLIP_LOAN_1_TO_4_UNITS not found"
  );
}

await prisma.lenderProduct.upsert({
  where: {
    lenderOrgId_loanProductCode: {
      lenderOrgId: organization.id,
      loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    },
  },
  update: {},
  create: {
    lenderOrgId: organization.id,
    loanProductId: loanProduct.id,
    loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",

    minLoanAmount: 500000,
    maxLoanAmount: 3000000,

    minTermMonths: 6,
    maxTermMonths: 24,

    minCreditScore: 300,

    maxLtvPercent: 80,
    maxLtcPercent: 90,
    maxArvPercent: 70,

    statesSupported: "Iowa,Texas,Florida",

    propertyTypes: ["MULTIFAMILY"],

    minExperience: "1",

    interestRateRange: "8%-12%",

    isActive: true,
  },
});

for (let i = 1; i <= 8; i++) {
  const orgName = `Eligible Lender ${i}`;

let org = await prisma.organization.findFirst({
  where: {
    name: orgName,
  },
});

if (!org) {
  org = await prisma.organization.create({
    data: {
      name: orgName,
      email: `eligible${i}@lendingcart.com`,
      type: "LENDER",
      status: "ACTIVE",
    },
  });
}
  const user = await prisma.userAccount.upsert({
    where: {
      email: `eligible${i}@lendingcart.com`,
    },
    update: {},
    create: {
      organizationId: org.id,
      email: `eligible${i}@lendingcart.com`,
      passwordHash,
      firstName: "Eligible",
      lastName: `Lender ${i}`,
      status: "ACTIVE",
    },
  });

  const roleExists = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      roleId: role.id,
    },
  });

  if (!roleExists) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

 const existingProfile = await prisma.lenderProfile.findFirst({
  where: {
    lenderOrgId: org.id,
  },
});

if (!existingProfile) {
  await prisma.lenderProfile.create({
    data: {
      lenderOrgId: org.id,
      summary: "Fix and Flip lender",
      loanTypes: ["FIX_AND_FLIP_LOAN_1_TO_4_UNITS"],
      minFunding: 500000,
      maxFunding: 3000000,
      statesSupported: "Iowa,Texas,Florida",
      industries: "Real Estate",
      fundingSpeedDays: 5,
      profileStatus: "COMPLETED",
      isVisible: true,
    },
  });
}

  await prisma.lenderProduct.upsert({
    where: {
      lenderOrgId_loanProductCode: {
        lenderOrgId: org.id,
        loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
      },
    },
    update: {},
    create: {
      lenderOrgId: org.id,
      loanProductId: loanProduct.id,
      loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",

      minLoanAmount: 500000,
      maxLoanAmount: 3000000,

      minTermMonths: 6,
      maxTermMonths: 24,

      minCreditScore: 300,

      maxLtvPercent: 80,
      maxLtcPercent: 90,
      maxArvPercent: 70,

      statesSupported: "Iowa,Texas,Florida",

      propertyTypes: ["MULTIFAMILY"],

      minExperience: "1",

      interestRateRange: "8%-12%",

      isActive: true,
    },
  });

  console.log(`✅ Eligible Lender ${i} created`);
}

  return lenderUser;
}

module.exports = {
  seedLenderUser,
};