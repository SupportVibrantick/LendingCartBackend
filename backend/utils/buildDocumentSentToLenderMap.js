async function buildDocumentSentToLenderMap(prisma, loanApplicationId) {
  const [submissions, applicationLenders] = await Promise.all([
    prisma.applicationDocumentSubmission.findMany({
      where: {
        applicationLender: { loanApplicationId },
      },
      select: {
        applicationLenderId: true,
        submittedAt: true,
        documentUploadId: true,
        documentUpload: {
          select: { documentRequirementId: true },
        },
      },
    }),
    prisma.applicationLender.findMany({
      where: { loanApplicationId },
      include: {
        lender: { select: { name: true } },
      },
    }),
  ]);

  const lenderNameById = new Map(
    applicationLenders.map((entry) => [
      entry.id,
      entry.lender?.name || "Lender",
    ]),
  );

  const byRequirement = new Map();
  const byUpload = new Map();

  for (const submission of submissions) {
    const requirementId = submission.documentUpload?.documentRequirementId;
    const uploadId = submission.documentUploadId;

    if (!requirementId || !uploadId) continue;

    if (!byUpload.has(uploadId)) {
      byUpload.set(uploadId, new Map());
    }

    const uploadLenderEntries = byUpload.get(uploadId);
    const existingUploadEntry = uploadLenderEntries.get(
      submission.applicationLenderId,
    );

    if (
      !existingUploadEntry ||
      submission.submittedAt > existingUploadEntry.sentAt
    ) {
      uploadLenderEntries.set(submission.applicationLenderId, {
        sentAt: submission.submittedAt,
      });
    }

    if (!byRequirement.has(requirementId)) {
      byRequirement.set(requirementId, new Map());
    }

    const lenderEntries = byRequirement.get(requirementId);
    let entry = lenderEntries.get(submission.applicationLenderId);

    if (!entry) {
      entry = { sentUploadIds: new Set(), sentAt: null };
      lenderEntries.set(submission.applicationLenderId, entry);
    }

    entry.sentUploadIds.add(uploadId);

    if (!entry.sentAt || submission.submittedAt > entry.sentAt) {
      entry.sentAt = submission.submittedAt;
    }
  }

  return { byRequirement, byUpload, lenderNameById };
}

function formatSentToLenders(
  requirementId,
  requestedBy,
  byRequirement,
  lenderNameById,
  uploadedCount = 0,
) {
  const sentMap = byRequirement.get(requirementId) || new Map();
  const entries = new Map();

  for (const lender of requestedBy) {
    if (!lender.applicationLenderId) continue;

    const sent = sentMap.get(lender.applicationLenderId);
    const sentCount = sent?.sentUploadIds?.size || 0;
    const pendingCount = Math.max(0, uploadedCount - sentCount);

    entries.set(lender.applicationLenderId, {
      applicationLenderId: lender.applicationLenderId,
      lenderName:
        lender.lenderName ||
        lenderNameById.get(lender.applicationLenderId) ||
        "Lender",
      isSent: sentCount > 0,
      sentCount,
      pendingCount,
      uploadedCount,
      isFullySent: uploadedCount > 0 && sentCount >= uploadedCount,
      sentAt: sent?.sentAt || null,
    });
  }

  for (const [applicationLenderId, sent] of sentMap.entries()) {
    if (entries.has(applicationLenderId)) continue;

    const sentCount = sent.sentUploadIds?.size || 0;
    const pendingCount = Math.max(0, uploadedCount - sentCount);

    entries.set(applicationLenderId, {
      applicationLenderId,
      lenderName: lenderNameById.get(applicationLenderId) || "Lender",
      isSent: sentCount > 0,
      sentCount,
      pendingCount,
      uploadedCount,
      isFullySent: uploadedCount > 0 && sentCount >= uploadedCount,
      sentAt: sent.sentAt,
    });
  }

  const sentToLenders = [...entries.values()];

  return {
    sentToLenders,
    isSentToAnyLender: sentToLenders.some((item) => item.isSent),
    hasPendingSendToLender: sentToLenders.some((item) => item.pendingCount > 0),
  };
}

function formatUploadSentToLenders(uploadId, byUpload, lenderNameById) {
  const lenderMap = byUpload.get(uploadId);

  if (!lenderMap || lenderMap.size === 0) {
    return [];
  }

  return [...lenderMap.entries()].map(([applicationLenderId, data]) => ({
    applicationLenderId,
    lenderName: lenderNameById.get(applicationLenderId) || "Lender",
    isSent: true,
    sentAt: data.sentAt,
  }));
}

module.exports = {
  buildDocumentSentToLenderMap,
  formatSentToLenders,
  formatUploadSentToLenders,
};
