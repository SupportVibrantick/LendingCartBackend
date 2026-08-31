const bcrypt = require("bcrypt");
const prisma = require("../client");
const {
  BROKER_EMAIL,
  BROKER_PASSWORD,
  BROKER_ORG_NAME,
} = require("../seedConfig");

async function seedBrokerUser() {
  const brokerEmail = BROKER_EMAIL;
  const brokerPassword = BROKER_PASSWORD;
  const brokerOrgName = BROKER_ORG_NAME;

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
    12
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