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

  const applicationLenderIds = [
    ...new Set(lenderRequests.map((item) => item.applicationLenderId)),
  ];

  if (applicationLenderIds.length === 0) {
    return { forwarded: false, reason: "no_lenders", submittedCount: 0 };
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

  await prisma.applicationLender.updateMany({
    where: {
      id: { in: applicationLenderIds },
      loanApplicationId,
    },
    data: {
      status: "IN_REVIEW",
      sentAt: new Date(),
    },
  });

  await prisma.loanApplication.update({
    where: { id: loanApplicationId },
    data: { status: "IN_REVIEW" },
  });

  return {
    forwarded: true,
    submittedCount: applicationLenderIds.length,
    applicationLenderIds,
  };
}

module.exports = { autoForwardDocumentUpload };
