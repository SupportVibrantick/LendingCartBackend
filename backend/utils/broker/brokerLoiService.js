const fs = require("fs");
const path = require("path");
const {
  buildLoiTemplateData,
  buildSubmissionFieldMap,
  pickField,
} = require("../../services/loi/buildLoiTemplateData");
const { generateLoiPdf } = require("../../services/loi/generateLoiPdf");
const {
  getBrokerWhiteLabelBranding,
} = require("../../services/broker/brokerBranding");
const {
  resolveBrokerLoiBranding,
} = require("../../services/loi/resolveLoiBranding");
const {
  syncLoiRequiredDocuments,
  extractStoredBrokerLoiDocumentNames,
} = require("../../services/loi/syncLoiRequiredDocuments");
const {
  getTotalLoanAmountWithFinancedFees,
} = require("../../services/loi/financedLoanAmount");
const {
  resolveLatestActiveSubmission,
} = require("../../utils/applications/clientPortalSubmission");
const {
  APPLICATION_LENDER_LOI_INCLUDE,
} = require("./brokerLoiList");
const {
  upsertBrokerLoiSignRequirement,
  buildSignWorkflowPayload,
  findBrokerLoiSignRequirement,
  sendBrokerLoiToClient,
  forwardBrokerLoiToLender,
} = require("./brokerLoiSignWorkflow");

const APPLICATION_INCLUDE = {
  client: { include: { contacts: true } },
  brokerUser: { include: { brokerProfile: true } },
  brokerOrg: true,
  collaterals: true,
  submissions: {
    where: { status: { not: "SUPERSEDED" } },
    include: {
      fields: {
        include: {
          builderField: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  },
};

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function pickNumericField(fieldMap, ...keys) {
  for (const key of keys) {
    const numeric = toPositiveNumber(fieldMap?.[key]);
    if (numeric != null) return numeric;
  }
  return null;
}

function getActiveSubmission(application) {
  return resolveLatestActiveSubmission(application?.submissions || []);
}

function defaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function parseTermMonths(label) {
  if (!label) return 12;
  const months = String(label).match(/(\d+)\s*Months?/i);
  if (months) return Number(months[1]);
  const years = String(label).match(/(\d+)\s*Years?/i);
  if (years) return Number(years[1]) * 12;
  const numeric = Number(String(label).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 12;
}

function serializeBrokerLoiTerms(formTerms = {}) {
  const approvedAmount = Number(formTerms.approvedAmount) || 0;
  const interestRate = Number(formTerms.interestRate) || 0;
  const originationFeePercent = formTerms.originationFeePercent || "2%";
  const exitFee = formTerms.exitFee || "0%";
  const processingFee = formTerms.processingFee || "$995";
  const underwritingFee = formTerms.underwritingFee || "$750";

  const { totalLoanAmount, financedFees } = getTotalLoanAmountWithFinancedFees({
    approvedAmount,
    originationFeePercent,
    exitFee,
    processingFee,
    underwritingFee,
  });

  const interestOnly = Boolean(formTerms.interestOnly);
  const termMonths = parseTermMonths(formTerms.loanTerm || "12 Months");
  let monthlyPayment = Number(formTerms.monthlyPayment) || 0;

  if (totalLoanAmount && interestRate && termMonths) {
    if (interestOnly) {
      monthlyPayment = (totalLoanAmount * interestRate) / 100 / 12;
    } else {
      const monthlyRate = interestRate / 100 / 12;
      monthlyPayment =
        monthlyRate === 0
          ? totalLoanAmount / termMonths
          : (totalLoanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
            (Math.pow(1 + monthlyRate, termMonths) - 1);
    }
    monthlyPayment = Number(monthlyPayment.toFixed(2));
  }

  return {
    approvedAmount,
    totalLoanAmount: totalLoanAmount || approvedAmount,
    financedFees,
    interestRateType: "FIXED",
    interestRate,
    interestRateDisplay: `${interestRate}%`,
    variableRateIndex: null,
    variableRateSpread: null,
    loanTerm: formTerms.loanTerm || "12 Months",
    amortization: interestOnly ? "Interest Only" : (formTerms.amortization || "30 Years"),
    paymentFrequency: interestOnly
      ? "Interest Only"
      : (formTerms.paymentFrequency || "Monthly"),
    interestOnly,
    ltvPercent:
      formTerms.ltvPercent != null && formTerms.ltvPercent !== ""
        ? Number(formTerms.ltvPercent)
        : null,
    ltcPercent:
      formTerms.ltcPercent != null && formTerms.ltcPercent !== ""
        ? Number(formTerms.ltcPercent)
        : null,
    arvPercent:
      formTerms.arvPercent != null && formTerms.arvPercent !== ""
        ? Number(formTerms.arvPercent)
        : null,
    monthlyPayment,
    originationFeePercent,
    exitFee,
    processingFee,
    underwritingFee,
    legalFee: formTerms.legalFee || "Borrower Pays",
    appraisalRequired: formTerms.appraisalRequired || "Yes",
    environmentalReport: formTerms.environmentalReport || "Required",
    personalGuarantee: formTerms.personalGuarantee || "Required",
    prepaymentPenalty: formTerms.prepaymentPenalty || "None",
    recourse: formTerms.recourse || "Full",
    requiredDocuments: Array.isArray(formTerms.requiredDocuments)
      ? formTerms.requiredDocuments.filter(Boolean)
      : [],
    closingConditions: Array.isArray(formTerms.requiredDocuments)
      ? formTerms.requiredDocuments.filter(Boolean)
      : [],
    specialConditions: Array.isArray(formTerms.specialConditions)
      ? formTerms.specialConditions.filter(Boolean)
      : [],
    expirationDate: formTerms.expirationDate || defaultExpirationDate(),
  };
}

function stringifyFormField(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseStoredInterestRate(stored = {}) {
  if (stored.interestRate != null && stored.interestRate !== "") {
    return stringifyFormField(stored.interestRate);
  }

  const display = String(stored.interestRateDisplay || "").trim();
  if (!display) return "";

  const numeric = Number(display.replace(/%/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : display;
}

function mapStoredLoiTermsToForm(stored) {
  if (!stored || typeof stored !== "object") return null;

  const approvedAmount = stored.approvedAmount;
  if (approvedAmount == null || approvedAmount === "") return null;

  const requiredDocuments = Array.isArray(stored.requiredDocuments)
    ? stored.requiredDocuments.map((item) => String(item || "").trim()).filter(Boolean)
    : Array.isArray(stored.closingConditions)
      ? stored.closingConditions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

  return {
    approvedAmount: stringifyFormField(approvedAmount),
    interestRate: parseStoredInterestRate(stored),
    ltvPercent:
      stored.ltvPercent != null && stored.ltvPercent !== ""
        ? stringifyFormField(stored.ltvPercent)
        : "",
    ltcPercent:
      stored.ltcPercent != null && stored.ltcPercent !== ""
        ? stringifyFormField(stored.ltcPercent)
        : "",
    arvPercent:
      stored.arvPercent != null && stored.arvPercent !== ""
        ? stringifyFormField(stored.arvPercent)
        : "",
    monthlyPayment:
      stored.monthlyPayment != null && stored.monthlyPayment !== ""
        ? stringifyFormField(stored.monthlyPayment)
        : "",
    interestOnly: Boolean(stored.interestOnly),
    loanTerm: stored.loanTerm ? String(stored.loanTerm) : "12 Months",
    requiredDocuments,
    customDocument: "",
    originationFeePercent: stored.originationFeePercent || "2%",
    exitFee: stored.exitFee || "0%",
    processingFee: stored.processingFee || "$995",
    underwritingFee: stored.underwritingFee || "$750",
    legalFee: stored.legalFee || "Borrower Pays",
    appraisalRequired: stored.appraisalRequired || "Yes",
    environmentalReport: stored.environmentalReport || "Required",
    personalGuarantee: stored.personalGuarantee || "Required",
    prepaymentPenalty: stored.prepaymentPenalty || "None",
    recourse: stored.recourse || "Full",
    amortization: stored.amortization || "",
    paymentFrequency: stored.paymentFrequency || "",
    expirationDate: stored.expirationDate || "",
    specialConditions: Array.isArray(stored.specialConditions)
      ? stored.specialConditions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
  };
}

function buildPrefillTerms(sourceRecord, application, submission) {
  const fromStored = mapStoredLoiTermsToForm(sourceRecord?.loiTermsJson);
  if (fromStored) {
    return fromStored;
  }

  const review = sourceRecord?.lenderReviews?.[0];
  const fieldMap = buildSubmissionFieldMap(submission?.fields || []);
  const approvedAmount =
    review?.approvedAmount != null
      ? Number(review.approvedAmount)
      : pickNumericField(fieldMap, "amountRequested", "loanAmount") ||
        (application?.amountRequested != null
          ? Number(application.amountRequested)
          : null);

  const interestRate =
    review?.interestRate != null ? Number(review.interestRate) : null;

  const termMonths =
    application?.termMonthsRequested ||
    parseTermMonths(pickField(fieldMap, "loanTerm", "termMonths"));

  const loanTerm = `${termMonths || 12} Months`;
  const interestOnly = true;
  const originationFeePercent = "2%";
  const exitFee = "0%";
  const processingFee = "$995";
  const underwritingFee = "$750";

  const { totalLoanAmount } = getTotalLoanAmountWithFinancedFees({
    approvedAmount,
    originationFeePercent,
    exitFee,
    processingFee,
    underwritingFee,
  });

  let monthlyPayment = null;
  if (totalLoanAmount && interestRate) {
    monthlyPayment = (totalLoanAmount * interestRate) / 100 / 12;
  }

  const propertyValue = pickNumericField(
    fieldMap,
    "propertyValue",
    "asIsValue",
    "purchasePrice",
  );
  const projectCost = pickNumericField(
    fieldMap,
    "totalProjectCost",
    "projectCost",
    "purchasePrice",
  );
  const arv = pickNumericField(fieldMap, "afterRepairValue", "arv");

  const requiredDocuments =
    (review?.conditions || [])
      .map((item) => item.description)
      .filter(Boolean) || [];

  return {
    approvedAmount: approvedAmount ? String(approvedAmount) : "",
    interestRate: interestRate ? String(interestRate) : "",
    ltvPercent:
      totalLoanAmount && propertyValue
        ? String(Number(((totalLoanAmount / propertyValue) * 100).toFixed(2)))
        : "",
    ltcPercent:
      totalLoanAmount && projectCost
        ? String(Number(((totalLoanAmount / projectCost) * 100).toFixed(2)))
        : "",
    arvPercent:
      totalLoanAmount && arv
        ? String(Number(((totalLoanAmount / arv) * 100).toFixed(2)))
        : "",
    monthlyPayment:
      monthlyPayment != null ? String(Number(monthlyPayment.toFixed(2))) : "",
    interestOnly,
    loanTerm,
    requiredDocuments,
    customDocument: "",
    originationFeePercent: "2%",
    exitFee: "0%",
    processingFee: "$995",
    underwritingFee: "$750",
    legalFee: "Borrower Pays",
    appraisalRequired: "Yes",
    environmentalReport: "Required",
    personalGuarantee: "Required",
    prepaymentPenalty: "None",
    recourse: "Full",
    amortization: interestOnly ? "Interest Only" : "30 Years",
    paymentFrequency: interestOnly ? "Interest Only" : "Monthly",
    expirationDate: defaultExpirationDate(),
    specialConditions: [],
  };
}

function buildApplicationContext(submission, application) {
  const fieldMap = buildSubmissionFieldMap(submission?.fields || []);
  const client = application?.client;
  const primaryContact = client?.contacts?.[0];
  const borrowerFirst =
    pickField(fieldMap, "borrowerFirstName", "firstName") ||
    primaryContact?.firstName ||
    "";
  const borrowerLast =
    pickField(fieldMap, "borrowerLastName", "lastName") ||
    primaryContact?.lastName ||
    "";

  return {
    borrowerName:
      `${borrowerFirst} ${borrowerLast}`.trim() ||
      client?.legalName ||
      "",
    propertyAddress: pickField(
      fieldMap,
      "propertyAddress",
      "property_address",
      "address",
    ),
    propertyType: pickField(fieldMap, "propertyType", "property_type")?.replace(
      /_/g,
      " ",
    ),
    loanProduct: application?.loanProductCode?.replace(/_/g, " ") || "",
    brokerName:
      `${application?.brokerUser?.firstName || ""} ${application?.brokerUser?.lastName || ""}`.trim() ||
      application?.brokerOrg?.name ||
      "",
  };
}

async function loadBrokerApplication(prisma, applicationId, brokerOrgId, brokerUserId) {
  const where = {
    id: applicationId,
    brokerOrgId,
  };

  if (brokerUserId) {
    where.brokerUserId = brokerUserId;
  }

  return prisma.loanApplication.findFirst({
    where,
    include: APPLICATION_INCLUDE,
  });
}

async function getBrokerLoiPrefill(
  prisma,
  { applicationId, sourceApplicationLenderId, brokerOrgId, brokerUserId },
) {
  const application = await loadBrokerApplication(
    prisma,
    applicationId,
    brokerOrgId,
    brokerUserId,
  );

  if (!application) {
    return { error: { status: 404, message: "Application not found" } };
  }

  const sourceRecord = await prisma.applicationLender.findFirst({
    where: {
      id: sourceApplicationLenderId,
      loanApplicationId: applicationId,
      loiUrl: { not: null },
      loiSentToBrokerAt: { not: null },
    },
    include: APPLICATION_LENDER_LOI_INCLUDE,
  });

  if (!sourceRecord) {
    return {
      error: { status: 404, message: "Selected lender LOI not found" },
    };
  }

  const submission = getActiveSubmission(application);

  const whiteLabel = await getBrokerWhiteLabelBranding(prisma, brokerOrgId);
  const fromStoredBrokerLoi =
    application.brokerLoiSourceApplicationLenderId === sourceApplicationLenderId
      ? mapStoredLoiTermsToForm(application.brokerLoiTerms)
      : null;
  const terms =
    fromStoredBrokerLoi ||
    buildPrefillTerms(sourceRecord, application, submission);

  return {
    data: {
      applicationId,
      sourceApplicationLenderId,
      sourceLenderName: sourceRecord.lender?.name || "Lender",
      sourceLoiUrl: sourceRecord.loiUrl,
      terms,
      applicationContext: buildApplicationContext(submission, application),
      brokerBranding: {
        brandName: whiteLabel.brokerBrandName,
        logoUrl: whiteLabel.brokerLogoUrl,
        isComplete: Boolean(
          whiteLabel.brokerBrandName?.trim() && whiteLabel.brokerLogoUrl,
        ),
      },
      existingBrokerLoi: {
        brokerLoiUrl: application.brokerLoiUrl,
        generatedAt: application.brokerLoiGeneratedAt,
        sourceApplicationLenderId:
          application.brokerLoiSourceApplicationLenderId,
      },
    },
  };
}

async function getBrokerLoiStatus(
  prisma,
  { applicationId, brokerOrgId, brokerUserId },
) {
  const application = await loadBrokerApplication(
    prisma,
    applicationId,
    brokerOrgId,
    brokerUserId,
  );

  if (!application) {
    return { error: { status: 404, message: "Application not found" } };
  }

  let sourceLenderName = null;
  if (application.brokerLoiSourceApplicationLenderId) {
    const source = await prisma.applicationLender.findUnique({
      where: { id: application.brokerLoiSourceApplicationLenderId },
      include: { lender: { select: { name: true } } },
    });
    sourceLenderName = source?.lender?.name || null;
  }

  const submission = getActiveSubmission(application);
  const signRequirement = await findBrokerLoiSignRequirement(
    prisma,
    applicationId,
    brokerOrgId,
  );

  return {
    data: {
      applicationId,
      brokerLoiUrl: application.brokerLoiUrl,
      brokerLoiGeneratedAt: application.brokerLoiGeneratedAt,
      sourceApplicationLenderId:
        application.brokerLoiSourceApplicationLenderId,
      sourceLenderName,
      terms: application.brokerLoiTerms || null,
      signWorkflow: buildSignWorkflowPayload(
        signRequirement,
        submission?.id || null,
      ),
    },
  };
}

function buildBrokerLoiPdfData({
  baseLoiData,
  brokerBranding,
  brokerOrg,
  brokerProfile,
  fundingLenderName,
}) {
  const brokerBrandName =
    brokerBranding?.brokerBrandName?.trim() ||
    brokerOrg?.name ||
    baseLoiData.brokerCompany ||
    "Broker";

  const addressParts = [
    brokerProfile?.address,
    [brokerProfile?.city, brokerProfile?.state].filter(Boolean).join(", "),
    brokerProfile?.zipCode,
  ].filter(Boolean);

  return {
    ...baseLoiData,
    fundingLenderName,
    lenderBrandName: brokerBrandName,
    lenderName: brokerBrandName,
    lenderLogoUrl: brokerBranding?.brokerLogoUrl || null,
    lenderWebsite: brokerProfile?.website?.trim() || "",
    lenderContactEmail:
      brokerBranding?.supportEmail?.trim() ||
      brokerOrg?.email?.trim() ||
      baseLoiData.brokerEmail ||
      "",
    lenderContactPhone: brokerOrg?.phone?.trim() || baseLoiData.brokerPhone || "",
    lenderAddress: addressParts.join(" • "),
    disclaimerText: [
      "The undersigned acknowledge that:",
      "This is a preliminary summary of non-binding terms for discussion purposes only.",
      `${brokerBrandName} has presented these proposed terms based on lender indications and application information provided.`,
      fundingLenderName
        ? `Terms are based on the selected lender proposal from ${fundingLenderName} and remain subject to that lender's final underwriting and approval.`
        : "",
      "This document is not a commitment to lend, nor does it guarantee that final loan documents will contain these or any other specific terms.",
      "Final approval is subject to satisfactory completion of underwriting, due diligence, appraisal, legal review, and execution of definitive loan documents acceptable to the funding lender in its sole discretion.",
      baseLoiData.expirationDate
        ? `This offer is valid until ${baseLoiData.expirationDate}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function generateBrokerLoi(
  prisma,
  {
    applicationId,
    sourceApplicationLenderId,
    brokerTerms,
    branding,
    brokerOrgId,
    brokerUserId,
    userId,
  },
) {
  const application = await loadBrokerApplication(
    prisma,
    applicationId,
    brokerOrgId,
    brokerUserId,
  );

  if (!application) {
    return { error: { status: 404, message: "Application not found" } };
  }

  const sourceRecord = await prisma.applicationLender.findFirst({
    where: {
      id: sourceApplicationLenderId,
      loanApplicationId: applicationId,
      loiUrl: { not: null },
      loiSentToBrokerAt: { not: null },
    },
    include: {
      ...APPLICATION_LENDER_LOI_INCLUDE,
      lender: {
        include: {
          lenderProfile: true,
        },
      },
    },
  });

  if (!sourceRecord) {
    return {
      error: { status: 404, message: "Selected lender LOI not found" },
    };
  }

  const serializedTerms = serializeBrokerLoiTerms(brokerTerms);
  const previousDocumentNames = extractStoredBrokerLoiDocumentNames(
    application.brokerLoiTerms,
  );

  if (
    !Number.isFinite(serializedTerms.approvedAmount) ||
    serializedTerms.approvedAmount <= 0
  ) {
    return { error: { status: 400, message: "Approved amount is required" } };
  }

  if (
    !Number.isFinite(serializedTerms.interestRate) ||
    serializedTerms.interestRate <= 0
  ) {
    return { error: { status: 400, message: "Interest rate is required" } };
  }

  if (!serializedTerms.requiredDocuments.length) {
    return {
      error: { status: 400, message: "At least one required document is needed" },
    };
  }

  let whiteLabel;
  try {
    whiteLabel = await resolveBrokerLoiBranding(prisma, brokerOrgId, branding);
  } catch (brandingError) {
    return {
      error: {
        status: 400,
        message:
          brandingError.message ||
          "Broker branding is incomplete. Add brand name and logo before generating a broker LOI.",
      },
    };
  }

  const submission = getActiveSubmission(application);

  const baseLoiData = buildLoiTemplateData({
    submission,
    loanApplication: application,
    lenderRecord: sourceRecord,
    applicationLenderId: sourceRecord.id,
    collaterals: application.collaterals || [],
    lenderTerms: serializedTerms,
    lenderBranding: null,
  });

  const brokerProfile = application.brokerUser?.brokerProfile || null;

  const settings = await prisma.brokerWhiteLabelSetting.findFirst({
    where: { brokerOrgId },
    select: { supportEmail: true },
  });

  const loiData = buildBrokerLoiPdfData({
    baseLoiData,
    brokerBranding: {
      ...whiteLabel,
      supportEmail: settings?.supportEmail,
    },
    brokerOrg: application.brokerOrg,
    brokerProfile,
    fundingLenderName: sourceRecord.lender?.name || "Lender",
  });

  const pdfBuffer = await generateLoiPdf(loiData);

  const outputDir = path.join(process.cwd(), "public", "broker", "LOI");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `broker-loi-${applicationId}-${Date.now()}.pdf`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, pdfBuffer);

  const fileUrl = `/broker/LOI/${fileName}`;

  const updated = await prisma.loanApplication.update({
    where: { id: applicationId },
    data: {
      brokerLoiUrl: fileUrl,
      brokerLoiSourceApplicationLenderId: sourceApplicationLenderId,
      brokerLoiTerms: brokerTerms,
      brokerLoiGeneratedAt: new Date(),
      brokerLoiGeneratedByUserId: userId,
    },
    select: {
      id: true,
      brokerLoiUrl: true,
      brokerLoiGeneratedAt: true,
      brokerLoiSourceApplicationLenderId: true,
    },
  });

  try {
    await syncLoiRequiredDocuments(prisma, {
      loanApplicationId: applicationId,
      applicationLenderId: sourceApplicationLenderId,
      documentNames: serializedTerms.requiredDocuments,
      actor: "BROKER",
      orgId: brokerOrgId,
      previousDocumentNames,
      replaceBrokerLoiSet: true,
    });
  } catch (syncError) {
    console.error(
      "Failed to sync broker LOI required documents to application requirements:",
      syncError,
    );
  }

  const signRequirementResult = await upsertBrokerLoiSignRequirement(prisma, {
    applicationId,
    brokerOrgId,
    sourceApplicationLenderId,
    brokerLoiUrl: fileUrl,
    fileName,
  });

  if (signRequirementResult?.error) {
    return signRequirementResult;
  }

  return {
    data: {
      applicationId,
      brokerLoiUrl: updated.brokerLoiUrl,
      brokerLoiGeneratedAt: updated.brokerLoiGeneratedAt,
      sourceApplicationLenderId: updated.brokerLoiSourceApplicationLenderId,
      sourceLenderName: sourceRecord.lender?.name || "Lender",
      signWorkflow: buildSignWorkflowPayload(
        signRequirementResult,
        submission?.id || null,
      ),
    },
  };
}

module.exports = {
  getBrokerLoiPrefill,
  getBrokerLoiStatus,
  generateBrokerLoi,
  serializeBrokerLoiTerms,
  sendBrokerLoiToClient,
  forwardBrokerLoiToLender,
};
