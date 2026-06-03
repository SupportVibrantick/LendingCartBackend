const generateAgreementHtml = require("./generateAgreementHtml");

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
      client: true,
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

const clientFirstName =
  fieldMap.borrowerFirstName ||
  fieldMap.first_name ||
  primaryContact?.firstName ||
  "";

const clientLastName =
  fieldMap.borrowerLastName ||
  fieldMap.last_name ||
  primaryContact?.lastName ||
  "";

  const clientFullName =
    `${clientFirstName} ${clientLastName}`.trim() ||
    loan.client?.legalName ||
    "N/A";

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
    `${brokerFirstName} ${brokerLastName}`.trim() || "N/A";

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
  "N/A";

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
    clientEntityName: loan.client?.legalName || "",
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

  // 🧾 HTML
  const agreementHtml = generateAgreementHtml(snapshotData);

  // 💾 SAVE
  const feeAgreement = await prisma.feeAgreement.create({
    data: {
      loanApplicationId: loan.id,
      brokerOrgId: loan.brokerOrgId,
      clientId: loan.clientId,
      ...snapshotData,
      agreementHtml,
      status: "DRAFT",
    },
  });

  return feeAgreement;
};