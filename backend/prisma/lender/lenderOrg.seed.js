const prisma = require("../client");

async function seedLenderOrg() {
  const lenderName =
    process.env.SEED_LENDER_ORG_NAME || "Demo Lender";

  let organization = await prisma.organization.findFirst({
    where: {
      name: lenderName,
    },
  });

  if (organization) {
    console.log(
      `ℹ️ Lender organization already exists: ${organization.name}`
    );

    return organization;
  }

  organization = await prisma.organization.create({
    data: {
      name: lenderName,
      type: "LENDER",
      status: "ACTIVE",
      email:
        process.env.SEED_LENDER_ORG_EMAIL ||
        "lender@lendingcart.local",
      phone:
        process.env.SEED_LENDER_ORG_PHONE ||
        "+10000000002",
    },
  });

  console.log(
    `✅ Lender organization created: ${organization.name}`
  );

  return organization;
}

module.exports = {
  seedLenderOrg,
};