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

function getSignedUpload(requirement) {
  return (requirement.uploads || []).find((upload) => upload.isSignedOutput);
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
    signStatusLabel:
      SIGN_STATUS_LABELS[requirement.signStatus] || requirement.signStatus,
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
          uploadId: signedUpload.id,
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
};
