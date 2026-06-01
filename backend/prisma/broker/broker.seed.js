const bcrypt = require("bcryptjs");
const prisma = require("../client");

async function seedBrokerUser() {
const brokerEmail =
  process.env.SEED_BROKER_EMAIL || "broker@lendingcart.com";

const brokerPassword =
  process.env.SEED_BROKER_PASSWORD || "Broker@123";

  const brokerOrgName =
    process.env.SEED_BROKER_ORG_NAME || "Demo Broker";

  const organization = await prisma.organization.findFirst({
    where: {
      name: brokerOrgName,
    },
  });

  if (!organization) {
    throw new Error(
      `Broker organization not found: ${brokerOrgName}`
    );
  }

  const role = await prisma.role.findFirst({
    where: {
      name: "BROKER_ADMIN",
    },
  });

  if (!role) {
    throw new Error("BROKER_ADMIN role not found");
  }

  const passwordHash = await bcrypt.hash(
    brokerPassword,
    10
  );

  let brokerUser = await prisma.userAccount.findUnique({
    where: {
      email: brokerEmail,
    },
  });

  if (!brokerUser) {
    brokerUser = await prisma.userAccount.create({
      data: {
        organizationId: organization.id,
        email: brokerEmail,
        passwordHash,
        firstName: "Broker",
        lastName: "Admin",
        status: "ACTIVE",
      },
    });

    console.log(
      `✅ Broker user created: ${brokerUser.email}`
    );
  } else {
    console.log(
      `ℹ️ Broker user already exists: ${brokerUser.email}`
    );
  }

  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: brokerUser.id,
      roleId: role.id,
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: brokerUser.id,
        roleId: role.id,
      },
    });

    console.log("✅ BROKER_ADMIN role assigned");
  } else {
    console.log("ℹ️ BROKER_ADMIN role already assigned");
  }

  return brokerUser;
}

module.exports = {
  seedBrokerUser,
};