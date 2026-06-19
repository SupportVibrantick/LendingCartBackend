const generateAgreementHtml = require("./generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  buildBrandingSnapshot,
} = require("../../../../services/brokerBranding");
const {
  resolveClientDisplayNameFromData,
  resolveClientEntityLabelFromData,
} = require("../../../../services/resolveClientDisplayName");

function extractValue(val) {
  if (!val) return "";

  // Handle JSON types
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

  // 🛑 Prevent duplicate
  const existing = await prisma.feeAgreement.findUnique({
    where: { loanApplicationId: loanId },
  });
  if (existing) return existing;

  // 📥 Fetch Loan
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

  // 📥 Primary Contact
  const primaryContact = await prisma.clientContact.findFirst({
    where: {
      clientId: loan.clientId,
      isPrimary: true,
    },
  });

  // 📥 Submission
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

  // 🔥 FIELD MAP (FIXED)
  const fieldMap = {};

  submission.fields.forEach((f) => {
    if (f.fieldKey) {
      fieldMap[f.fieldKey] = extractValue(f.value);
    }
  });

  // ===============================
  // ✅ CLIENT MAPPING (FIXED)
  // ===============================

  const submissions = [submission];
  const clientFullName = resolveClientDisplayNameFromData(loan.client, submissions);
  const clientEntityName = resolveClientEntityLabelFromData(loan.client, submissions);

  const clientAddress =
    fieldMap.address ||
    `${fieldMap.address_line1 || ""} ${fieldMap.city || ""} ${
      fieldMap.state || ""
    } ${fieldMap.zip || ""}`.trim();

  // ===============================
  // ✅ BROKER MAPPING (FIXED)
  // ===============================

  const brokerFirstName = loan.brokerUser?.firstName || "";
  const brokerLastName = loan.brokerUser?.lastName || "";

  const brokerFullName =
    `${brokerFirstName} ${brokerLastName}`.trim() ||
    loan.brokerOrg?.name ||
    null;

  const brokerProfile = loan.brokerUser?.brokerProfile;

const brokerAddress =
  brokerProfile?.address ||
  loan.brokerOrg?.address ||
  [
    brokerProfile?.city,
    brokerProfile?.state,
    brokerProfile?.zipCode,
  ]
    .filter(Boolean)
    .join(", ") ||
  null;

  // ===============================
  // ✅ SUBJECT PROPERTY
  // ===============================

const subjectAddress =
  fieldMap.propertyAddress ||
  fieldMap.businessAddress ||
  fieldMap.subjectProperty ||
  fieldMap.property_address ||
  fieldMap.business_address ||
  fieldMap.subject_property ||
  `${fieldMap.propertyStreet || ""} ${
    fieldMap.propertyCity || ""
  }`.trim();

  // ===============================
  // ✅ SNAPSHOT
  // ===============================

  const snapshotData = {
    // CLIENT
    clientName: clientFullName,
    clientEntityName,
    clientEmail: primaryContact?.email || "",
    clientPhone:
  primaryContact?.phone ||
  fieldMap.phone ||
  fieldMap.mobile ||
  "",
    clientAddress:
  clientAddress ||
  primaryContact?.address ||
  "",

    // BROKER
    brokerName: brokerFullName,
brokerCompany:
  loan.brokerOrg?.name ||
  brokerProfile?.company ||
  "",
    brokerEmail: loan.brokerUser?.email || "",
brokerPhone:
  loan.brokerOrg?.phone ||
  loan.brokerUser?.phone ||
  "",
brokerAddress,
    brokerState: brokerProfile?.state || "",
    brokerCounty: "",

    // SUBJECT
    subjectAddress,

    // FEES
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

  // 🧾 HTML
  const agreementHtml = generateAgreementHtml(agreementPayload);

  // 💾 SAVE
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