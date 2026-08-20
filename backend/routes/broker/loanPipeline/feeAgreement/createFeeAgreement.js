const generateAgreementHtml = require("./generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  buildBrandingSnapshot,
} = require("../../../../services/broker/brokerBranding");
const {
  loadOrgBrokerUser,
  resolveFeeAgreementSnapshot,
} = require("../../../../services/feeAgreement/feeAgreementFieldResolver");

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

function pickTerm(preferred, fallback = null) {
  if (preferred === undefined || preferred === null || preferred === "") {
    return fallback;
  }
  return preferred;
}

module.exports = async function createFeeAgreement(fastify, loanId, terms = null) {
  const prisma = fastify.prisma;

  const existing = await prisma.feeAgreement.findUnique({
    where: { loanApplicationId: loanId },
  });

  if (existing?.status === "SIGNED") {
    return existing;
  }

  if (existing && !terms) {
    return existing;
  }

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
    },
    include: { fields: true },
    orderBy: { createdAt: "desc" },
  });

  if (!submission) {
    throw new Error("No submission found");
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
    brokerPoints: pickTerm(terms?.brokerPoints, existing?.brokerPoints ?? null),
    upfrontFee: pickTerm(terms?.upfrontFee, existing?.upfrontFee ?? null),
    exclusivityMonths: pickTerm(
      terms?.exclusivityMonths,
      existing?.exclusivityMonths ?? null,
    ),
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

  if (existing) {
    return prisma.feeAgreement.update({
      where: { id: existing.id },
      data: {
        ...agreementPayload,
        agreementHtml,
      },
    });
  }

  return prisma.feeAgreement.create({
    data: {
      loanApplicationId: loan.id,
      brokerOrgId: loan.brokerOrgId,
      clientId: loan.clientId,
      ...agreementPayload,
      agreementHtml,
      status: "DRAFT",
    },
  });
};
