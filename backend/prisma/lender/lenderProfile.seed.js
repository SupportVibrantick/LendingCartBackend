const prisma = require("../client");

async function seedLenderProfile() {
  const lenderOrgName =
    process.env.SEED_LENDER_ORG_NAME || "Demo Lender";

  const organization = await prisma.organization.findFirst({
    where: {
      name: lenderOrgName,
      type: "LENDER",
    },
  });

  if (!organization) {
    throw new Error(
      `Lender organization not found: ${lenderOrgName}`
    );
  }

  const existingProfile = await prisma.lenderProfile.findUnique({
    where: {
      lenderOrgId: organization.id,
    },
  });

  if (existingProfile) {
    console.log(
      `ℹ️ Lender profile already exists for ${organization.name}`
    );

    return existingProfile;
  }

  const lenderProfile = await prisma.lenderProfile.create({
    data: {
      lenderOrgId: organization.id,

      summary:
        "Demo lender profile for development and testing.",

      loanTypes: [
        "BRIDGE_LOAN",
        "DSCR_LOAN_1_TO_4_UNITS",
        "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
      ],

      minFunding: 50000,
      maxFunding: 5000000,

      statesSupported: "CA,TX,FL,NY",

      industries:
        "Real Estate, Construction, Commercial Lending",

      fundingSpeedDays: 7,

      profileStatus: "COMPLETED",

      isVisible: true,
    },
  });

  console.log(
    `✅ Lender profile created for ${organization.name}`
  );

  return lenderProfile;
}

module.exports = {
  seedLenderProfile,
};