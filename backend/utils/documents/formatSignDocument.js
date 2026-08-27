const { getSignDocumentWorkflow } = require("./signDocumentWorkflow");

const SIGN_STATUS_LABELS = {
  AWAITING_BROKER: "Awaiting broker",
  SENT_TO_CLIENT: "Sent to client",
  CLIENT_SIGNED: "Client signed",
  FORWARDED_TO_LENDER: "Forwarded to lender",
  LENDER_SEEN: "Seen by lender",
};

const REQUEST_APPLICATION_LENDER_INCLUDE = {
  lender: { select: { id: true, name: true } },
  lenderProduct: {
    include: {
      loanProduct: { select: { name: true, code: true } },
    },
  },
};

const ACTIVE_SIGNED_STATUSES = [
  "CLIENT_SIGNED",
  "FORWARDED_TO_LENDER",
  "LENDER_SEEN",
];

function getSignedUpload(requirement) {
  if (!ACTIVE_SIGNED_STATUSES.includes(requirement.signStatus)) {
    return null;
  }

  return (requirement.uploads || []).find((upload) => upload.isSignedOutput);
}

function buildFormProgress(requirement) {
  if (requirement.signMode !== "DYNAMIC_FORM") return null;

  const schema =
    requirement.activeFormVersion?.schemaJson ||
    requirement.signFormDefinition?.versions?.[0]?.schemaJson;
  if (!schema?.fields?.length) return null;

  const submission = (requirement.signFormSubmissions || [])[0] || null;
  const values = {};
  for (const item of submission?.values || []) {
    values[item.fieldKey] = item.valueJson;
  }

  try {
    const {
      computeProgress,
    } = require("../../services/documents/signForm/submissionService");
    return computeProgress(schema, values);
  } catch {
    return null;
  }
}

function formatSignDocumentRequirement(requirement, options = {}) {
  const signedUploadRaw = getSignedUpload(requirement);
  const viewer = options.viewer || "broker";
  const canViewSignedUpload =
    viewer === "broker" ||
    viewer === "client" ||
    (viewer === "lender" &&
      (requirement.signStatus === "FORWARDED_TO_LENDER" ||
        requirement.signStatus === "LENDER_SEEN"));
  const signedUpload =
    signedUploadRaw && canViewSignedUpload
      ? {
          uploadId: signedUploadRaw.id,
          fileName: signedUploadRaw.fileName,
          fileUrl: signedUploadRaw.fileUrl,
          fileMimeType: signedUploadRaw.fileMimeType,
          uploadedAt: signedUploadRaw.uploadedAt,
          clientSignatureData: signedUploadRaw.clientSignatureData || null,
        }
      : null;
  const lenderName =
    requirement.requestApplicationLender?.lender?.name ||
    options.lenderName ||
    null;
  const loanProductName =
    requirement.requestApplicationLender?.lenderProduct?.loanProduct?.name ||
    null;
  const loanProductCode =
    requirement.requestApplicationLender?.lenderProduct?.loanProduct?.code ||
    null;

  const formProgress =
    options.formProgress || buildFormProgress(requirement);
  const workflow = getSignDocumentWorkflow(
    {
      ...requirement,
      formProgress,
    },
    formProgress,
  );

  const schemaFields =
    requirement.activeFormVersion?.schemaJson?.fields ||
    requirement.signFormDefinition?.versions?.[0]?.schemaJson?.fields ||
    [];
  const hasSignatureField = schemaFields.some(
    (field) => field?.type === "signature" || field?.type === "initial",
  );

  return {
    requirementId: requirement.id,
    documentTypeId: requirement.documentTypeId,
    documentName:
      requirement.signDocumentTitle ||
      requirement.documentType?.name ||
      "Document",
    source: requirement.source,
    requiresClientSignature: true,
    signStatus: requirement.signStatus,
    signStatusLabel: workflow.signStatusLabel,
    workflowHint: workflow.workflowHint,
    brokerBucket: workflow.brokerBucket,
    lenderBucket: workflow.lenderBucket,
    clientBucket: workflow.clientBucket,
    signMode: requirement.signMode || "SIGNATURE_ONLY",
    formProcessingStatus: requirement.formProcessingStatus || "NONE",
    activeFormVersionId: requirement.activeFormVersionId || null,
    fieldCount: schemaFields.length || null,
    hasSignatureField:
      requirement.signMode === "DYNAMIC_FORM" ? hasSignatureField : null,
    formProgress,
    templateFileName: requirement.templateFileName,
    templateFileUrl: requirement.templateFileUrl,
    templateMimeType: requirement.templateMimeType,
    sentToClientAt: requirement.sentToClientAt,
    clientSignedAt: requirement.clientSignedAt,
    lenderSeenAt: requirement.lenderSeenAt,
    requestApplicationLenderId: requirement.requestApplicationLenderId,
    lenderOrgId: requirement.requestApplicationLender?.lenderOrgId || null,
    lenderName,
    loanProductName,
    loanProductCode,
    requestedAt: requirement.lastRequestedAt || requirement.createdAt,
    signedUpload: signedUpload
      ? {
          uploadId: signedUpload.uploadId,
          fileName: signedUpload.fileName,
          fileUrl: signedUpload.fileUrl,
          fileMimeType: signedUpload.fileMimeType,
          uploadedAt: signedUpload.uploadedAt,
          clientSignatureData: signedUpload.clientSignatureData || null,
        }
      : null,
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt,
  };
}

module.exports = {
  SIGN_STATUS_LABELS,
  REQUEST_APPLICATION_LENDER_INCLUDE,
  formatSignDocumentRequirement,
  getSignedUpload,
  ACTIVE_SIGNED_STATUSES,
  buildFormProgress,
};
