const DOCUMENT_DELIVERY_BLOCKED_STATUSES = new Set([
  "APPROVED",
  "DECLINED",
  "WITHDRAWN",
]);

function canLenderReceiveDocuments(status) {
  return !DOCUMENT_DELIVERY_BLOCKED_STATUSES.has(status);
}

function getLenderDocumentDeliveryBlockMessage(status) {
  switch (status) {
    case "APPROVED":
      return "This lender is already approved and cannot receive additional documents.";
    case "DECLINED":
      return "This lender has declined the application and cannot receive documents.";
    case "WITHDRAWN":
      return "This lender has withdrawn from the application and cannot receive documents.";
    default:
      return "This lender cannot receive documents in their current status.";
  }
}

async function filterReceivableApplicationLenderIds(prisma, applicationLenderIds) {
  if (!Array.isArray(applicationLenderIds) || applicationLenderIds.length === 0) {
    return [];
  }

  const lenders = await prisma.applicationLender.findMany({
    where: {
      id: { in: applicationLenderIds },
    },
    select: {
      id: true,
      status: true,
    },
  });

  return lenders
    .filter((lender) => canLenderReceiveDocuments(lender.status))
    .map((lender) => lender.id);
}

module.exports = {
  DOCUMENT_DELIVERY_BLOCKED_STATUSES,
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
  filterReceivableApplicationLenderIds,
};
