const {
  resolveAutoForwardApplicationLenderIds,
} = require("../utils/filterDocumentRequirementsForLender");
const {
  applyDocumentSendStatusUpdates,
} = require("./applyDocumentSendStatusUpdates");

/**
 * Forward a newly uploaded document when auto-forward is enabled.
 * Client/lender-requested docs go to requesting lenders.
 * Broker/sub-broker docs go to lenders the deal was submitted to.
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
      source: true,
      documentTypeId: true,
    },
  });

  if (!requirement) {
    return {
      forwarded: false,
      reason: "requirement_not_found",
      submittedCount: 0,
    };
  }

  const { applicationLenderIds, candidateCount, mode } =
    await resolveAutoForwardApplicationLenderIds(prisma, {
      loanApplicationId,
      requirement,
    });

  if (applicationLenderIds.length === 0) {
    return {
      forwarded: false,
      reason:
        mode === "broker_added_submitted_lenders"
          ? candidateCount > 0
            ? "no_receivable_lenders"
            : "no_submitted_lenders"
          : "no_receivable_lenders",
      submittedCount: 0,
      skippedLenderCount: candidateCount - applicationLenderIds.length,
      mode,
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
    skippedLenderCount: candidateCount - applicationLenderIds.length,
    mode,
  };
}

module.exports = { autoForwardDocumentUpload };
