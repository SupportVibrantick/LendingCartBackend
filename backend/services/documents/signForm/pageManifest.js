const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

function resolveDiskPathFromPublicUrl(fileUrl) {
  const relative = String(fileUrl || "").replace(/^\/+/, "");
  const publicCandidate = path.join(process.cwd(), "public", relative);
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }
  return path.join(process.cwd(), relative);
}

/**
 * Build page manifest in PDF points (72 DPI).
 * Origin for field coords is bottom-left (pdf-lib).
 */
async function buildPageManifestFromTemplate({
  templateFileUrl,
  templateMimeType,
  templateFileName,
}) {
  const templatePath = resolveDiskPathFromPublicUrl(templateFileUrl);
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found on server");
  }

  const mime = String(templateMimeType || "").toLowerCase();
  const ext = path.extname(templateFileName || templatePath || "").toLowerCase();

  if (mime === "application/pdf" || ext === ".pdf") {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
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
    const metadata = await sharp(templatePath).metadata();
    const widthPx = metadata.width || 612;
    const heightPx = metadata.height || 792;

    // Treat image pixels as PDF points at 72 DPI for overlay/flatten consistency.
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
  buildPageManifestFromTemplate,
  emptySchemaForPages,
};
