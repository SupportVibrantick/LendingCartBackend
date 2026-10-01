const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");
const {
  getBufferFromRef,
  keyFromFileUrl,
  local,
} = require("../../storage");

function resolveDiskPathFromPublicUrl(fileUrl) {
  const relative = String(fileUrl || "").replace(/^\/+/, "");
  const publicCandidate = path.join(process.cwd(), "public", relative);
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }
  return path.join(process.cwd(), relative);
}

/**
 * Load template/upload bytes from local disk or S3.
 */
async function loadBytesFromPublicUrl(fileUrl, prisma) {
  const key = keyFromFileUrl(fileUrl);
  return getBufferFromRef(
    {
      storageKey: key,
      fileUrl,
    },
    prisma,
  );
}

/**
 * Prefer existing local path; otherwise materialize a temp file from storage.
 * Caller should unlink when done if `cleanup` is true.
 */
async function ensureLocalPathFromPublicUrl(fileUrl, prisma) {
  const diskPath = resolveDiskPathFromPublicUrl(fileUrl);
  if (fs.existsSync(diskPath)) {
    return { path: diskPath, cleanup: false };
  }

  const key = keyFromFileUrl(fileUrl);
  if (key && (await local.exists(key))) {
    return { path: local.diskPathFromKey(key), cleanup: false };
  }

  const bytes = await loadBytesFromPublicUrl(fileUrl, prisma);
  const ext = path.extname(diskPath) || ".bin";
  const tmp = path.join(
    os.tmpdir(),
    `lc-storage-${crypto.randomBytes(8).toString("hex")}${ext}`,
  );
  await fs.promises.writeFile(tmp, bytes);
  return { path: tmp, cleanup: true };
}

/**
 * Build page manifest in PDF points (72 DPI).
 * Origin for field coords is bottom-left (pdf-lib).
 */
async function buildPageManifestFromTemplate({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  prisma,
}) {
  const bytes = await loadBytesFromPublicUrl(templateFileUrl, prisma);

  const mime = String(templateMimeType || "").toLowerCase();
  const ext = path
    .extname(templateFileName || templateFileUrl || "")
    .toLowerCase();

  if (mime === "application/pdf" || ext === ".pdf") {
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    return pages.map((page, index) => {
      const { width, height } = page.getSize();
      return {
        page: index + 1,
        widthPt: width,
        heightPt: height,
        imageUrl: null,
        rotation: 0,
      };
    });
  }

  if (mime.startsWith("image/")) {
    const metadata = await sharp(bytes).metadata();
    const widthPx = metadata.width || 612;
    const heightPx = metadata.height || 792;

    return [
      {
        page: 1,
        widthPt: widthPx,
        heightPt: heightPx,
        imageUrl: templateFileUrl,
        rotation: 0,
      },
    ];
  }

  throw new Error("Unsupported template type. Use PDF or image.");
}

function emptySchemaForPages(pages) {
  return {
    schemaVersion: 1,
    pages,
    fields: [],
    conditionals: [],
    tables: [],
  };
}

module.exports = {
  resolveDiskPathFromPublicUrl,
  loadBytesFromPublicUrl,
  ensureLocalPathFromPublicUrl,
  buildPageManifestFromTemplate,
  emptySchemaForPages,
};
