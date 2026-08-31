const bcrypt = require("bcrypt");
const prisma = require("../client");
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PLATFORM_ORG_NAME,
} = require("../seedConfig");

async function seedAdminUser() {
  const adminEmail = ADMIN_EMAIL;
  const adminPassword = ADMIN_PASSWORD;
  const organizationName = PLATFORM_ORG_NAME;

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

  const passwordHash = await bcrypt.hash(adminPassword, 12);

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