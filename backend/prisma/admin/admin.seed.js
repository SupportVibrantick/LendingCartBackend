const bcrypt = require("bcryptjs");
const prisma = require("../client");

async function seedAdminUser() {
const adminEmail =
  process.env.SEED_ADMIN_EMAIL || "admin@lendingcart.com";

const adminPassword =
  process.env.SEED_ADMIN_PASSWORD || "admin@123";

  const organizationName =
    process.env.SEED_PLATFORM_ORG_NAME || "LendingCart Platform";

  const organization = await prisma.organization.findFirst({
    where: {
      name: organizationName,
    },
  });

  if (!organization) {
    throw new Error(
      `Platform organization not found: ${organizationName}`
    );
  }

  const role = await prisma.role.findFirst({
    where: {
      name: "PLATFORM_ADMIN",
    },
  });

  if (!role) {
    throw new Error("PLATFORM_ADMIN role not found");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  let admin = await prisma.userAccount.findUnique({
    where: {
      email: adminEmail,
    },
  });

  if (!admin) {
    admin = await prisma.userAccount.create({
      data: {
        organizationId: organization.id,
        email: adminEmail,
        passwordHash,
        firstName: "Platform",
        lastName: "Admin",
        status: "ACTIVE",
      },
    });

    console.log(`✅ Admin user created: ${admin.email}`);
  } else {
    console.log(`ℹ️ Admin user already exists: ${admin.email}`);
  }

  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: admin.id,
      roleId: role.id,
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: role.id,
      },
    });

    console.log("✅ PLATFORM_ADMIN role assigned");
  } else {
    console.log("ℹ️ PLATFORM_ADMIN role already assigned");
  }

  return admin;
}

module.exports = {
  seedAdminUser,
};