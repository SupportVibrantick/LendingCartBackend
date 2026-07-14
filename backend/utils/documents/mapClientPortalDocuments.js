const CLIENT_VISIBLE_DOC_SOURCES = new Set([
  "BROKER_ADDED",
  "LENDER_ADDED",
  "SUB_BROKER_ADDED",
]);

function isDocumentVisibleToClient(doc) {
  if (!doc || !CLIENT_VISIBLE_DOC_SOURCES.has(doc.source)) {
    return false;
  }

  // Sign docs have their own client flow
  if (doc.requiresClientSignature) {
    return false;
  }

  // Lender-requested upload docs stay broker-only until forwarded
  if (doc.source === "LENDER_ADDED" && !doc.sentToClientAt) {
    return false;
  }

  return true;
}

function mapClientPortalDocuments(documentRequirements = []) {
  return documentRequirements
    .filter(isDocumentVisibleToClient)
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
  isDocumentVisibleToClient,
};
