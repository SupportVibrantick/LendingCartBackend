/**
 * Sync lender_document_requirements for a lender product.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {string} lenderProductId
 * @param {Array<{ id?: string; documentTypeId?: string }>} documents
 */
async function syncLenderProductDocuments(tx, lenderProductId, documents = []) {
  const selectedTypeIds = [
    ...new Set(
      (documents || [])
        .map((doc) => doc.documentTypeId || doc.id)
        .filter(Boolean),
    ),
  ];

  const existing = await tx.lenderDocumentRequirement.findMany({
    where: { lenderProductId },
    select: { id: true, documentTypeId: true },
  });

  for (const req of existing) {
    if (!selectedTypeIds.includes(req.documentTypeId)) {
      await tx.lenderDocumentRequirement.delete({ where: { id: req.id } });
    }
  }

  for (let i = 0; i < selectedTypeIds.length; i++) {
    const documentTypeId = selectedTypeIds[i];

    await tx.lenderDocumentRequirement.upsert({
      where: {
        lenderProductId_documentTypeId: {
          lenderProductId,
          documentTypeId,
        },
      },
      update: {
        sortOrder: i,
        isRequired: true,
      },
      create: {
        lenderProductId,
        documentTypeId,
        isRequired: true,
        minFiles: 1,
        sortOrder: i,
      },
    });
  }
}

function mapLenderDocumentRequirements(requirements = []) {
  if (!Array.isArray(requirements)) return [];

  return requirements.map((doc) => ({
    id: doc.documentTypeId || doc.documentType?.id,
    requirementId: doc.id,
    documentTypeId: doc.documentTypeId || doc.documentType?.id,
    documentName: doc.documentType?.name || null,
    documentCode: doc.documentType?.code || null,
    isCustom: doc.documentType?.isCustom || false,
    isRequired: doc.isRequired,
    minFiles: doc.minFiles,
    maxFiles: doc.maxFiles,
    notes: doc.notes,
    sortOrder: doc.sortOrder,
    name: doc.documentType?.name || null,
  }));
}

module.exports = {
  syncLenderProductDocuments,
  mapLenderDocumentRequirements,
};
