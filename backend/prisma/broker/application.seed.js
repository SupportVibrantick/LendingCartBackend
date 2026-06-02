const prisma = require("../client");

async function seedEligibleApplication() {
  const brokerOrg = await prisma.organization.findFirst({
    where: {
      type: "BROKER",
    },
  });

  if (!brokerOrg) {
    throw new Error("Broker organization not found");
  }

  const application = await prisma.loanApplication.create({
    data: {
      brokerOrgId: brokerOrg.id,
      loanProductCode: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
      amountRequested: 1000000,
      status: "SUBMITTED",
    },
  });

  const fields = [
    { fieldKey: "creditScore", value: "340" },
    { fieldKey: "amountRequested", value: 1000000 },
    { fieldKey: "loanTerm", value: "12" },

    { fieldKey: "propertyType", value: "MULTIFAMILY" },
    { fieldKey: "propertyState", value: "Iowa" },

    { fieldKey: "yearsInBusiness", value: "2" },

    { fieldKey: "ltvPercentage", value: 66.67 },
    { fieldKey: "ltcPercentage", value: 83.33 },
    { fieldKey: "arvPercentage", value: 50 },

    { fieldKey: "dscr", value: 4598.41 },
    { fieldKey: "netWorth", value: 230000 },

    { fieldKey: "borrowerFirstName", value: "Tushar" },
    { fieldKey: "borrowerLastName", value: "Jain" },
    { fieldKey: "companyName", value: "VIS" },
  ];

  const submission = await prisma.applicationSubmission.create({
    data: {
      applicationId: application.id,

      fields: {
        create: fields,
      },
    },
  });

  console.log("✅ Application Created");
  console.log("Application ID:", application.id);
  console.log("Submission ID:", submission.id);

  return {
    application,
    submission,
  };
}

module.exports = {
  seedEligibleApplication,
};