/**
 * Deactivate lender-owned custom document types that are no longer linked
 * to any product requirement or in-flight document request.
 */
async function deactivateOrphanedCustomDocumentType(
  prisma,
  documentTypeId,
  lenderOrgId,
) {
  if (!documentTypeId || !lenderOrgId) return false;

  const docType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: {
      id: true,
      isCustom: true,
      isActive: true,
      createdByOrgId: true,
    },
  });

  if (
    !docType?.isActive ||
    !docType.isCustom ||
    docType.createdByOrgId !== lenderOrgId
  ) {
    return false;
  }

  const [requirementCount, requestCount] = await Promise.all([
    prisma.lenderDocumentRequirement.count({
      where: {
        documentTypeId,
        lenderProduct: { lenderOrgId },
      },
    }),
    prisma.lenderDocumentRequest.count({
      where: {
        documentTypeId,
        applicationLender: { lenderOrgId },
      },
    }),
  ]);

  if (requirementCount > 0 || requestCount > 0) {
    return false;
  }

  await prisma.documentType.update({
    where: { id: documentTypeId },
    data: { isActive: false },
  });

  return true;
}

async function cleanupOrphanedCustomDocumentTypes(prisma, lenderOrgId) {
  if (!lenderOrgId) {
    return { deactivatedCount: 0, deactivatedIds: [] };
  }

  const customTypes = await prisma.documentType.findMany({
    where: {
      isActive: true,
      isCustom: true,
      createdByOrgId: lenderOrgId,
    },
    select: { id: true },
  });

  const deactivatedIds = [];

  for (const docType of customTypes) {
    const deactivated = await deactivateOrphanedCustomDocumentType(
      prisma,
      docType.id,
      lenderOrgId,
    );
    if (deactivated) {
      deactivatedIds.push(docType.id);
    }
  }

  return {
    deactivatedCount: deactivatedIds.length,
    deactivatedIds,
  };
}

module.exports = {
  deactivateOrphanedCustomDocumentType,
  cleanupOrphanedCustomDocumentTypes,
};
