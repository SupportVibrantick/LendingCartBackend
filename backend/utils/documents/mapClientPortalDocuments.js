const CLIENT_VISIBLE_DOC_SOURCES = new Set([
  "BROKER_ADDED",
  "LENDER_ADDED",
  "SUB_BROKER_ADDED",
]);

function mapClientPortalDocuments(documentRequirements = []) {
  return documentRequirements
    .filter(
      (doc) =>
        CLIENT_VISIBLE_DOC_SOURCES.has(doc.source) &&
        !doc.requiresClientSignature,
    )
    .map((doc) => ({
      id: doc.id,
      name: doc.documentType?.name || "Document",
      status: doc.status,
      required: doc.isRequired,
      source: doc.source,
      uploadedFiles: (doc.uploads || []).map((file) => ({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        uploadedAt: file.uploadedAt,
      })),
    }));
}

module.exports = {
  mapClientPortalDocuments,
  CLIENT_VISIBLE_DOC_SOURCES,
};
