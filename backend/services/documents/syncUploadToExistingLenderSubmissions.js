const {
  filterReceivableApplicationLenderIds,
} = require("../../utils/lender/lenderDocumentDelivery");

/**
 * When a requirement was already shared with lender(s), new uploads
 * should be visible to those same lenders.
 */
async function syncUploadToExistingLenderSubmissions(
  prisma,
  { loanApplicationId, documentRequirementId, documentUploadId },
) {
  const existingSubmissions =
    await prisma.applicationDocumentSubmission.findMany({
      where: {
        documentUpload: {
          loanApplicationId,
          documentRequirementId,
        },
      },
      select: { applicationLenderId: true },
      distinct: ["applicationLenderId"],
    });

  if (existingSubmissions.length === 0) {
    return { synced: false, applicationLenderIds: [] };
  }

  const existingApplicationLenderIds = [
    ...new Set(existingSubmissions.map((row) => row.applicationLenderId)),
  ];

  const applicationLenderIds = await filterReceivableApplicationLenderIds(
    prisma,
    existingApplicationLenderIds,
  );

  if (applicationLenderIds.length === 0) {
    return {
      synced: false,
      applicationLenderIds: [],
      skippedLenderCount:
        existingApplicationLenderIds.length - applicationLenderIds.length,
    };
  }

  await prisma.applicationDocumentSubmission.createMany({
    data: applicationLenderIds.map((applicationLenderId) => ({
      documentUploadId,
      applicationLenderId,
    })),
    skipDuplicates: true,
  });

  await prisma.applicationDocumentUpload.update({
    where: { id: documentUploadId },
    data: {
      isSubmittedToLender: true,
      submittedAt: new Date(),
    },
  });

  return {
    synced: true,
    applicationLenderIds,
    skippedLenderCount:
      existingApplicationLenderIds.length - applicationLenderIds.length,
  };
}

module.exports = { syncUploadToExistingLenderSubmissions };
