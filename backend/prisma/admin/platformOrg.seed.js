const prisma = require("../client");
const {
  PLATFORM_ORG_NAME,
  PLATFORM_ORG_EMAIL,
  PLATFORM_ORG_PHONE,
} = require("../seedConfig");

async function seedPlatformOrg() {
  const orgName = PLATFORM_ORG_NAME;

  const existingOrg = await prisma.organization.findFirst({
    where: {
      name: orgName,
    },
  });

  if (existingOrg) {
    console.log(
      `ℹ️ Platform organization already exists: ${existingOrg.name}`
    );

    return existingOrg;
  }

  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      type: "PLATFORM",
      status: "ACTIVE",
      email: PLATFORM_ORG_EMAIL,
      phone: PLATFORM_ORG_PHONE,
    },
  });

  console.log(
    `✅ Platform organization created: ${organization.name}`
  );

  return organization;
}

module.exports = {
  seedPlatformOrg,
};