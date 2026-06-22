const BROKER_SENDABLE_SOURCES = new Set(["BROKER_ADDED", "SUB_BROKER_ADDED"]);
const {
  filterReceivableApplicationLenderIds,
} = require("./lenderDocumentDelivery");

/**
 * Resolve which application lenders should receive an auto-forwarded upload.
 * Broker/sub-broker docs go to submitted lenders on the deal.
 * Lender-requested docs go to lenders that requested the document type.
 */
async function resolveAutoForwardApplicationLenderIds(
  prisma,
  { loanApplicationId, requirement },
) {
  if (BROKER_SENDABLE_SOURCES.has(requirement.source)) {
    const submittedLenders = await prisma.applicationLender.findMany({
      where: {
        loanApplicationId,
        sentAt: { not: null },
      },
      select: { id: true },
    });

    const candidateIds = submittedLenders.map((lender) => lender.id);
    const applicationLenderIds = await filterReceivableApplicationLenderIds(
      prisma,
      candidateIds,
    );

    return {
      applicationLenderIds,
      candidateCount: candidateIds.length,
      mode: "broker_added_submitted_lenders",
    };
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

  const candidateIds = [
    ...new Set(lenderRequests.map((item) => item.applicationLenderId)),
  ];

  const applicationLenderIds = await filterReceivableApplicationLenderIds(
    prisma,
    candidateIds,
  );

  return {
    applicationLenderIds,
    candidateCount: candidateIds.length,
    mode: "lender_requested",
  };
}

/**
 * Keep broker/sub-broker requested docs for any selected lender.
 * Lender-requested docs only go to lenders that requested them.
 */
async function filterRequirementIdsForLender(
  prisma,
  { loanApplicationId, applicationLenderId, requirementIds },
) {
  if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
    return { allowedIds: [], skippedIds: [] };
  }

  const requirements = await prisma.applicationDocumentRequirement.findMany({
    where: {
      id: { in: requirementIds },
      loanApplicationId,
    },
    select: {
      id: true,
      source: true,
      documentTypeId: true,
    },
  });

  const foundIds = new Set(requirements.map((req) => req.id));
  const skippedIds = requirementIds.filter((id) => !foundIds.has(id));
  const allowedIds = [];

  const lenderSpecificRequirements = requirements.filter(
    (req) => !BROKER_SENDABLE_SOURCES.has(req.source),
  );

  let allowedTypeIds = new Set();

  if (lenderSpecificRequirements.length > 0) {
    const lenderRequests = await prisma.lenderDocumentRequest.findMany({
      where: {
        loanApplicationId,
        applicationLenderId,
        documentTypeId: {
          in: lenderSpecificRequirements.map((req) => req.documentTypeId),
        },
      },
      select: { documentTypeId: true },
    });

    allowedTypeIds = new Set(lenderRequests.map((req) => req.documentTypeId));
  }

  for (const req of requirements) {
    if (BROKER_SENDABLE_SOURCES.has(req.source)) {
      allowedIds.push(req.id);
      continue;
    }

    if (allowedTypeIds.has(req.documentTypeId)) {
      allowedIds.push(req.id);
    } else {
      skippedIds.push(req.id);
    }
  }

  return { allowedIds, skippedIds };
}

module.exports = {
  filterRequirementIdsForLender,
  resolveAutoForwardApplicationLenderIds,
  BROKER_SENDABLE_SOURCES,
};
