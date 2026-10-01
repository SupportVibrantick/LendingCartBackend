const path = require("path");
const crypto = require("crypto");
const {
  getStorage,
  buildLoanDocumentKey,
} = require("../storage");

function getExtensionFromMime(mime) {
  switch (String(mime || "").toLowerCase()) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
    case "image/jfif":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

/**
 * Persist a validated loan-document stream via the active storage provider.
 *
 * @returns {Promise<{ fileUrl: string, storageKey: string, storageProvider: string, safeFileName: string }>}
 */
async function saveLoanDocumentFile({
  prisma,
  stream,
  originalFileName,
  mimeType,
  applicationId,
  requirementId,
}) {
  const randomName = crypto.randomBytes(16).toString("hex");
  const originalExt = path.extname(originalFileName || "");
  const safeExt = originalExt || getExtensionFromMime(mimeType);
  const safeFileName = `${randomName}${safeExt}`;

  const storageKey = buildLoanDocumentKey({
    applicationId,
    requirementId,
    fileName: safeFileName,
  });

  const storage = await getStorage(prisma);
  const stored = await storage.putStream({
    key: storageKey,
    stream,
    contentType: mimeType || "application/octet-stream",
  });

  return {
    fileUrl: stored.url,
    storageKey: stored.key,
    storageProvider: stored.provider,
    safeFileName,
  };
}

module.exports = {
  saveLoanDocumentFile,
  getExtensionFromMime,
  buildLoanDocumentKey,
};
