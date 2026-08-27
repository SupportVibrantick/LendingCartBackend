const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { resolveDiskPathFromPublicUrl } = require("./pageManifest");
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

function diskPathFromParts(relativeParts, filename) {
  return path.join(process.cwd(), "uploads", ...relativeParts, filename);
}

async function writeSignAssetFromStream({
  relativeParts,
  filename,
  stream,
  mimeType,
}) {
  assertAllowedUpload({ mimeType });
  const dir = path.join(process.cwd(), "uploads", ...relativeParts);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = diskPathFromParts(relativeParts, filename);
  await pipeline(stream, fs.createWriteStream(filePath));
  return {
    filePath,
    publicUrl: publicUrlFromParts(relativeParts, filename),
  };
}

async function copySignAsset({ fromPublicUrl, relativeParts, filename }) {
  const src = resolveDiskPathFromPublicUrl(fromPublicUrl);
  if (!fs.existsSync(src)) {
    const err = new Error("Template file not found on server");
    err.statusCode = 400;
    throw err;
  }
  const dir = path.join(process.cwd(), "uploads", ...relativeParts);
  await fs.promises.mkdir(dir, { recursive: true });
  const dest = diskPathFromParts(relativeParts, filename);
  await fs.promises.copyFile(src, dest);
  return {
    filePath: dest,
    publicUrl: publicUrlFromParts(relativeParts, filename),
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  assertAllowedUpload,
  publicUrlFromParts,
  writeSignAssetFromStream,
  copySignAsset,
};
