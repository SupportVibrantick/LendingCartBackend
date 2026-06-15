const prisma = require("../client");
const { BROKER_ORG_NAME, BROKER_ORG_EMAIL, BROKER_ORG_PHONE } = require("../seedConfig");

async function seedBrokerOrg() {
  const brokerName = BROKER_ORG_NAME;

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
      email: BROKER_ORG_EMAIL,
      phone: BROKER_ORG_PHONE,
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