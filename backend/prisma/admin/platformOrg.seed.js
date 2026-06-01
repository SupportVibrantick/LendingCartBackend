const prisma = require("../client");

async function seedPlatformOrg() {
  const orgName =
    process.env.SEED_PLATFORM_ORG_NAME || "LendingCart Platform";

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
      email:
        process.env.SEED_PLATFORM_ORG_EMAIL ||
        "platform@lendingcart.local",
      phone:
        process.env.SEED_PLATFORM_ORG_PHONE ||
        "+10000000000",
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