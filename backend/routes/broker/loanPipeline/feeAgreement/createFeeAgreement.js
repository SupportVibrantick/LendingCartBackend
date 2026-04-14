const generateAgreementHtml = require("./generateAgreementHtml");

module.exports = async function createFeeAgreement(fastify, loanId) {
  const prisma = fastify.prisma;

  // 🛑 Prevent duplicate creation
  const existing = await prisma.feeAgreement.findUnique({
    where: { loanApplicationId: loanId },
  });

  if (existing) return existing;

  // 📥 Fetch Loan + Relations
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

  if (!loan) {
    throw new Error("Loan not found");
  }

  // 📥 Get Primary Client Contact
  const primaryContact = await prisma.clientContact.findFirst({
    where: {
      clientId: loan.clientId,
      isPrimary: true,
    },
  });

  // =====================================================
  // 🔥 MAPPING LOGIC (FROM APPLICATION SUBMISSION FIELDS)
  // =====================================================

  const submission = await prisma.applicationSubmission.findFirst({
    where: {
      applicationId: loan.id,
      status: "COMPLETED",
    },
    include: {
      fields: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const fieldMap = {};

  if (submission?.fields?.length) {
    submission.fields.forEach((f) => {
      if (f.fieldKey) {
        fieldMap[f.fieldKey] = f.value;
      }
    });
  }

  // 🧠 CLIENT NAME
  const clientFirstName = fieldMap.first_name || "";
  const clientLastName = fieldMap.last_name || "";

  const clientFullName =
    `${clientFirstName} ${clientLastName}`.trim() ||
    primaryContact?.firstName ||
    loan.client?.legalName ||
    "";

  // 🏠 CLIENT ADDRESS (fallback chain)
  const clientAddress =
    fieldMap.address ||
    fieldMap.full_address ||
    fieldMap.residential_address ||
    "";

  // 🏢 SUBJECT PROPERTY ADDRESS
  const subjectAddress =
    fieldMap.property_address ||
    fieldMap.business_address ||
    fieldMap.subject_property ||
    "";

  // =====================================================
  // 🧠 SNAPSHOT DATA (FINAL)
  // =====================================================

  const snapshotData = {
    // CLIENT
    clientName: clientFullName,
    clientEntityName: loan.client?.legalName || "",
    clientEmail: primaryContact?.email || "",
    clientPhone: primaryContact?.phone || "",
    clientAddress,

    // BROKER
    brokerName: loan.brokerUser?.firstName || "",
    brokerCompany: loan.brokerUser?.brokerProfile?.company || "",
    brokerEmail: loan.brokerUser?.email || "",
    brokerPhone: loan.brokerUser?.phone || "",
    brokerAddress: loan.brokerUser?.brokerProfile?.address || "",
    brokerState: loan.brokerUser?.brokerProfile?.state || "",
    brokerCounty: "",

    // SUBJECT PROPERTY
    subjectAddress,

    // FEES (initially empty)
    brokerPoints: null,
    upfrontFee: null,
    exclusivityMonths: null,
  };

  // 🧾 Generate HTML
  const agreementHtml = generateAgreementHtml(snapshotData);

  // 💾 Save in DB
  const feeAgreement = await prisma.feeAgreement.create({
    data: {
      loanApplicationId: loan.id,
      brokerOrgId: loan.brokerOrgId,
      clientId: loan.clientId,

      // snapshot fields
      ...snapshotData,

      agreementHtml,
      status: "DRAFT",
    },
  });

  return feeAgreement;
};