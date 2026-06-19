async function buildDocumentSentToLenderMap(prisma, loanApplicationId) {
  const [submissions, applicationLenders] = await Promise.all([
    prisma.applicationDocumentSubmission.findMany({
      where: {
        applicationLender: { loanApplicationId },
      },
      select: {
        applicationLenderId: true,
        submittedAt: true,
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

  for (const submission of submissions) {
    const requirementId = submission.documentUpload?.documentRequirementId;
    if (!requirementId) continue;

    if (!byRequirement.has(requirementId)) {
      byRequirement.set(requirementId, new Map());
    }

    const lenderEntries = byRequirement.get(requirementId);
    const existing = lenderEntries.get(submission.applicationLenderId);

    if (!existing || submission.submittedAt > existing.sentAt) {
      lenderEntries.set(submission.applicationLenderId, {
        isSent: true,
        sentAt: submission.submittedAt,
      });
    }
  }

  return { byRequirement, lenderNameById };
}

function formatSentToLenders(
  requirementId,
  requestedBy,
  byRequirement,
  lenderNameById,
) {
  const sentMap = byRequirement.get(requirementId) || new Map();
  const entries = new Map();

  for (const lender of requestedBy) {
    if (!lender.applicationLenderId) continue;

    const sent = sentMap.get(lender.applicationLenderId);
    entries.set(lender.applicationLenderId, {
      applicationLenderId: lender.applicationLenderId,
      lenderName:
        lender.lenderName ||
        lenderNameById.get(lender.applicationLenderId) ||
        "Lender",
      isSent: Boolean(sent),
      sentAt: sent?.sentAt || null,
    });
  }

  for (const [applicationLenderId, sent] of sentMap.entries()) {
    if (entries.has(applicationLenderId)) continue;

    entries.set(applicationLenderId, {
      applicationLenderId,
      lenderName: lenderNameById.get(applicationLenderId) || "Lender",
      isSent: true,
      sentAt: sent.sentAt,
    });
  }

  const sentToLenders = [...entries.values()];

  return {
    sentToLenders,
    isSentToAnyLender: sentToLenders.some((item) => item.isSent),
  };
}

module.exports = {
  buildDocumentSentToLenderMap,
  formatSentToLenders,
};
