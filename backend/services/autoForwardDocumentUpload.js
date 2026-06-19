const {
  filterReceivableApplicationLenderIds,
} = require("../utils/lenderDocumentDelivery");
const {
  applyDocumentSendStatusUpdates,
} = require("./applyDocumentSendStatusUpdates");

/**
 * Forward a newly uploaded document to all lenders that requested it.
 */
async function autoForwardDocumentUpload(prisma, {
  loanApplicationId,
  documentRequirementId,
  documentUploadId,
}) {
  const requirement = await prisma.applicationDocumentRequirement.findFirst({
    where: {
      id: documentRequirementId,
      loanApplicationId,
    },
    select: {
      id: true,
      documentTypeId: true,
    },
  });

  if (!requirement) {
    return { forwarded: false, reason: "requirement_not_found", submittedCount: 0 };
  }

  const lenderRequests = await prisma.lenderDocumentRequest.findMany({
    where: {
      loanApplicationId,
      documentTypeId: requirement.documentTypeId,
    },
    select: {
      applicationLenderId: true,
    },
  });

  const requestedApplicationLenderIds = [
    ...new Set(lenderRequests.map((item) => item.applicationLenderId)),
  ];

  const applicationLenderIds = await filterReceivableApplicationLenderIds(
    prisma,
    requestedApplicationLenderIds,
  );

  if (applicationLenderIds.length === 0) {
    return {
      forwarded: false,
      reason: "no_receivable_lenders",
      submittedCount: 0,
      skippedLenderCount:
        requestedApplicationLenderIds.length - applicationLenderIds.length,
    };
  }

  const submissionRows = applicationLenderIds.map((applicationLenderId) => ({
    documentUploadId,
    applicationLenderId,
  }));

  await prisma.applicationDocumentSubmission.createMany({
    data: submissionRows,
    skipDuplicates: true,
  });

  await prisma.applicationDocumentUpload.update({
    where: { id: documentUploadId },
    data: {
      isSubmittedToLender: true,
      submittedAt: new Date(),
    },
  });

  await applyDocumentSendStatusUpdates(prisma, {
    loanApplicationId,
    applicationLenderIds,
  });

  return {
    forwarded: true,
    submittedCount: applicationLenderIds.length,
    applicationLenderIds,
    skippedLenderCount:
      requestedApplicationLenderIds.length - applicationLenderIds.length,
  };
}

module.exports = { autoForwardDocumentUpload };
