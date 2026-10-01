const { getStorage, keyFromFileUrl, getBufferFromRef } = require("../../storage");
const { getUploadMaxBytes } = require("./limits");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function assertAllowedUpload({ mimeType, byteLength } = {}) {
  if (mimeType && !ALLOWED_MIME_TYPES.has(String(mimeType).toLowerCase())) {
    const err = new Error("Only PDF or image files are allowed");
    err.statusCode = 400;
    throw err;
  }
  const maxBytes = getUploadMaxBytes();
  if (byteLength && byteLength > maxBytes) {
    const err = new Error(
      `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`,
    );
    err.statusCode = 400;
    throw err;
  }
}

function publicUrlFromParts(relativeParts, filename) {
  return `/${["uploads", ...relativeParts, filename].join("/")}`;
}

function keyFromParts(relativeParts, filename) {
  return ["uploads", ...relativeParts, filename].join("/");
}

/**
 * @param {{ relativeParts: string[], filename: string, stream: import("stream").Readable, mimeType?: string, prisma?: any }} args
 */
async function writeSignAssetFromStream({
  relativeParts,
  filename,
  stream,
  mimeType,
  prisma,
}) {
  assertAllowedUpload({ mimeType });
  const key = keyFromParts(relativeParts, filename);
  const storage = await getStorage(prisma);
  const stored = await storage.putStream({
    key,
    stream,
    contentType: mimeType || "application/octet-stream",
  });
  return {
    filePath: null,
    storageKey: stored.key,
    storageProvider: stored.provider,
    publicUrl: stored.url || publicUrlFromParts(relativeParts, filename),
  };
}

/**
 * @param {{ fromPublicUrl: string, relativeParts: string[], filename: string, prisma?: any, fromStorageKey?: string, fromStorageProvider?: string }} args
 */
async function copySignAsset({
  fromPublicUrl,
  relativeParts,
  filename,
  prisma,
  fromStorageKey,
  fromStorageProvider,
}) {
  const buffer = await getBufferFromRef(
    {
      storageKey: fromStorageKey || keyFromFileUrl(fromPublicUrl),
      storageProvider: fromStorageProvider || null,
      fileUrl: fromPublicUrl,
    },
    prisma,
  );

  const key = keyFromParts(relativeParts, filename);
  const storage = await getStorage(prisma);
  const stored = await storage.putBuffer({
    key,
    buffer,
    contentType: "application/octet-stream",
  });

  return {
    filePath: null,
    storageKey: stored.key,
    storageProvider: stored.provider,
    publicUrl: stored.url || publicUrlFromParts(relativeParts, filename),
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  assertAllowedUpload,
  publicUrlFromParts,
  keyFromParts,
  writeSignAssetFromStream,
  copySignAsset,
};
