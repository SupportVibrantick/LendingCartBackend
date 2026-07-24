async function countBrokerDocumentTypeUsage(prisma, documentTypeId, brokerOrgId) {
  return prisma.applicationDocumentRequirement.count({
    where: {
      documentTypeId,
      loanApplication: { brokerOrgId },
    },
  });
}

async function deactivateBrokerCustomDocumentType(
  prisma,
  documentTypeId,
  brokerOrgId,
) {
  if (!documentTypeId || !brokerOrgId) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  const docType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: {
      id: true,
      isCustom: true,
      isActive: true,
      createdByOrgId: true,
      code: true,
    },
  });

  if (
    !docType?.isActive ||
    !docType.isCustom ||
    docType.createdByOrgId !== brokerOrgId
  ) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (docType.code === "BROKER_LOI_TERM_SHEET") {
    return { ok: false, reason: "PROTECTED" };
  }

  const usageCount = await countBrokerDocumentTypeUsage(
    prisma,
    documentTypeId,
    brokerOrgId,
  );

  if (usageCount > 0) {
    return { ok: false, reason: "IN_USE", usageCount };
  }

  await prisma.documentType.update({
    where: { id: documentTypeId },
    data: { isActive: false },
  });

  return { ok: true };
}

module.exports = {
  countBrokerDocumentTypeUsage,
  deactivateBrokerCustomDocumentType,
};
