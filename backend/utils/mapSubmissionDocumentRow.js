const {
  formatSentToLenders,
  formatUploadSentToLenders,
} = require("./buildDocumentSentToLenderMap");
const { filterDocumentLenderContext } = require("./submissionDocumentsQuery");
const { resolveCoBrokerDocumentSourceName } = require("./resolveCoBrokerDocumentSourceName");

const submissionDocumentRequirementInclude = {
  documentType: true,
  requestedBySubBroker: {
    select: { id: true, firstName: true, lastName: true },
  },
  uploads: {
    orderBy: { uploadedAt: "desc" },
    include: {
      uploadedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      subBrokerSubmissions: {
        include: {
          submittedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  },
};

async function loadSubBrokerAssignmentNameMap(prisma, loanApplicationId) {
  const {
    buildSubBrokerAssignmentNameMap,
  } = require("./resolveCoBrokerDocumentSourceName");

  const assignments = await prisma.subBrokerApplication.findMany({
    where: { loanApplicationId },
    include: {
      subBroker: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return buildSubBrokerAssignmentNameMap(assignments);
}

function resolveDocumentDisplayStatus(requirement, matchedSubmission, sentInfo) {
  const submissionStatus =
    matchedSubmission?.subBrokerSubmissions?.[0]?.status;
  const requirementStatus = requirement.status;

  if (submissionStatus === "SKIPPED" || requirementStatus === "SKIPPED") {
    return "SKIPPED";
  }

  if (submissionStatus === "SENT_TO_LENDER") {
    return "SENT_TO_LENDER";
  }

  if (
    sentInfo?.isSentToAnyLender &&
    !sentInfo?.hasPendingSendToLender &&
    (requirement.uploads?.length ?? 0) > 0
  ) {
    return "SENT_TO_LENDER";
  }

  if (requirementStatus === "COMPLETE") {
    return "COMPLETE";
  }

  if (requirementStatus === "PARTIAL") {
    return "PARTIAL";
  }

  if (requirement.isSentToBroker && (requirement.uploads?.length ?? 0) > 0) {
    return "PARTIAL";
  }

  if (submissionStatus === "REVIEWED") {
    return "COMPLETE";
  }

  return submissionStatus || requirementStatus || "PENDING";
}

function mapSubmissionDocumentRow(
  requirement,
  {
    lenderMap,
    lenderFilterId,
    byRequirement,
    byUpload,
    lenderNameById,
    assignmentNamesBySubBrokerId,
  },
) {
  const matchedSubmission = requirement.uploads.find(
    (upload) => upload.subBrokerSubmissions?.length,
  );
  const uploadedCount = requirement.uploads.length;
  let requestedBy = lenderMap.get(requirement.documentTypeId) || [];

  if (lenderFilterId) {
    requestedBy = filterDocumentLenderContext(requestedBy, lenderFilterId);
  }

  const sentInfo = formatSentToLenders(
    requirement.id,
    requestedBy,
    byRequirement,
    lenderNameById,
    uploadedCount,
  );

  const sentToLenders = lenderFilterId
    ? filterDocumentLenderContext(sentInfo.sentToLenders, lenderFilterId)
    : sentInfo.sentToLenders;

  const subBrokerSourceName =
    requirement.source === "SUB_BROKER_ADDED"
      ? resolveCoBrokerDocumentSourceName(requirement, {
          assignmentNamesBySubBrokerId,
        })
      : null;

  return {
    requirementId: requirement.id,
    documentTypeId: requirement.documentTypeId,
    documentName: requirement.documentType?.name ?? null,
    source: requirement.source,
    isRequired: requirement.isRequired,
    isSentToBroker: requirement.isSentToBroker,
    status: resolveDocumentDisplayStatus(
      requirement,
      matchedSubmission,
      sentInfo,
    ),
    skipReason: matchedSubmission?.subBrokerSubmissions?.[0]?.skipReason || null,
    requestedByLenders: requestedBy,
    requestedByCount: requestedBy.length,
    sentToLenders,
    isSentToAnyLender: sentInfo.isSentToAnyLender,
    hasPendingSendToLender: sentInfo.hasPendingSendToLender,
    subBrokerSourceName,
    uploadedCount,
    uploadedFiles: requirement.uploads.map((upload) => ({
      uploadId: upload.id,
      fileName: upload.fileName,
      fileUrl: upload.fileUrl,
      fileMimeType: upload.fileMimeType,
      uploadedAt: upload.uploadedAt,
      sentToLenders: formatUploadSentToLenders(
        upload.id,
        byUpload,
        lenderNameById,
      ),
      isSentToAnyLender: byUpload.has(upload.id),
    })),
    subBrokerSubmissionId:
      matchedSubmission?.subBrokerSubmissions?.[0]?.id || null,
  };
}

module.exports = {
  submissionDocumentRequirementInclude,
  loadSubBrokerAssignmentNameMap,
  mapSubmissionDocumentRow,
};
