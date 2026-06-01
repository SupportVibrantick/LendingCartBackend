const prisma = require("../client");

async function seedBrokerOrg() {
  const brokerName =
    process.env.SEED_BROKER_ORG_NAME || "Demo Broker";

  let organization = await prisma.organization.findFirst({
    where: {
      name: brokerName,
    },
  });

  if (organization) {
    console.log(
      `ℹ️ Broker organization already exists: ${organization.name}`
    );

    return organization;
  }

  organization = await prisma.organization.create({
    data: {
      name: brokerName,
      type: "BROKER",
      status: "ACTIVE",
      email:
        process.env.SEED_BROKER_ORG_EMAIL ||
        "broker@lendingcart.local",
      phone:
        process.env.SEED_BROKER_ORG_PHONE ||
        "+10000000001",
    },
  });

  console.log(
    `✅ Broker organization created: ${organization.name}`
  );

  return organization;
}

module.exports = {
  seedBrokerOrg,
};