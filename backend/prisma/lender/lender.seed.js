const bcrypt = require("bcryptjs");
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
    10
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

  return lenderUser;
}

module.exports = {
  seedLenderUser,
};