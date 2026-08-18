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

  // Upload requests stay broker-only until forwarded to the client portal
  if (!doc.sentToClientAt) {
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
      requestedAt:
        doc.lastRequestedAt || doc.sentToClientAt || doc.createdAt || null,
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
