const generateAgreementHtml = require("./generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  buildBrandingSnapshot,
} = require("../../../../services/brokerBranding");
const {
  loadOrgBrokerUser,
  resolveFeeAgreementSnapshot,
} = require("../../../../services/feeAgreementFieldResolver");

function extractValue(val) {
  if (!val) return "";

  if (typeof val === "object") {
    return (
      val.text ||
      val.value ||
      val.label ||
      val.url ||
      JSON.stringify(val)
    );
  }

  return val;
}

module.exports = async function createFeeAgreement(fastify, loanId) {
  const prisma = fastify.prisma;

  const existing = await prisma.feeAgreement.findUnique({
    where: { loanApplicationId: loanId },
  });
  if (existing) return existing;

  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
    include: {
      client: {
        include: {
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          },
        },
      },
      brokerOrg: true,
      brokerUser: {
        include: {
          brokerProfile: true,
        },
      },
    },
  });

  if (!loan) throw new Error("Loan not found");

  const primaryContact =
    loan.client?.contacts?.find((contact) => contact.isPrimary) ||
    loan.client?.contacts?.[0] ||
    null;

  const submission = await prisma.applicationSubmission.findFirst({
    where: {
      applicationId: loan.id,
      status: "COMPLETED",
    },
    include: { fields: true },
    orderBy: { createdAt: "desc" },
  });

  if (!submission) {
    throw new Error("No completed submission found");
  }

  submission.fields.forEach((field) => {
    if (field.fieldKey && typeof field.value === "object" && field.value !== null) {
      field.value = extractValue(field.value);
    }
  });

  const orgBrokerUser = await loadOrgBrokerUser(
    prisma,
    loan.brokerOrgId,
    loan.brokerUserId,
  );

  const snapshotData = {
    ...resolveFeeAgreementSnapshot({
      loanApplication: loan,
      submission,
      primaryContact,
      orgBrokerUser,
    }),
    brokerPoints: null,
    upfrontFee: null,
    exclusivityMonths: null,
  };

  const whiteLabelBranding = await getBrokerWhiteLabelBranding(
    prisma,
    loan.brokerOrgId,
  );
  const brandingSnapshot = buildBrandingSnapshot(
    whiteLabelBranding,
    loan.brokerOrg?.name,
  );

  const agreementPayload = {
    ...snapshotData,
    ...brandingSnapshot,
  };

  const agreementHtml = generateAgreementHtml(agreementPayload);

  const feeAgreement = await prisma.feeAgreement.create({
    data: {
      loanApplicationId: loan.id,
      brokerOrgId: loan.brokerOrgId,
      clientId: loan.clientId,
      ...agreementPayload,
      agreementHtml,
      status: "DRAFT",
    },
  });

  return feeAgreement;
};
