const { PDFDocument } = require("pdf-lib");
const { getStorage, keyFromFileUrl, getBufferFromRef } = require("../../storage");

/** Options that tolerate LiveCycle / SBA / damaged AcroForm PDFs. */
const TOLERANT_PDF_LOAD = {
  ignoreEncryption: true,
  throwOnInvalidObject: false,
  updateMetadata: false,
};

/**
 * Load a PDF with tolerant parse options.
 * Strict pdf-lib loads fail on many production SBA templates
 * ("Failed to parse invalid PDF object").
 */
async function loadPdfDocument(bytes, extra = {}) {
  return PDFDocument.load(bytes, {
    ...TOLERANT_PDF_LOAD,
    ...extra,
  });
}

function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const head = Buffer.from(bytes).subarray(0, 5).toString("latin1");
  return head === "%PDF-";
}

/**
 * Re-serialize a PDF so pdf.js / browsers can open LiveCycle / broken-xref files.
 * Preserves AcroForm widgets when pdf-lib can read them.
 */
async function sanitizePdfBytes(bytes) {
  if (!looksLikePdf(bytes)) {
    const err = new Error("File is not a valid PDF");
    err.statusCode = 400;
    throw err;
  }

  const pdfDoc = await loadPdfDocument(bytes);
  const out = await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
  return Buffer.from(out);
}

/**
 * Load template bytes, sanitize if PDF, and rewrite storage in-place when cleaned.
 * Safe for already-uploaded Celtic/SBA templates that break the mapper viewer.
 */
async function repairStoredPdfTemplate({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  prisma,
  logger,
} = {}) {
  const mime = String(templateMimeType || "").toLowerCase();
  const name = String(templateFileName || templateFileUrl || "").toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  if (!isPdf || !templateFileUrl) {
    return { repaired: false, bytes: null };
  }

  const original = await getBufferFromRef(
    {
      storageKey: keyFromFileUrl(templateFileUrl),
      fileUrl: templateFileUrl,
    },
    prisma,
  );

  if (!looksLikePdf(original)) {
    const err = new Error(
      "Template file on disk is not a valid PDF (missing %PDF- header). Re-upload the form.",
    );
    err.statusCode = 400;
    throw err;
  }

  let sanitized;
  try {
    sanitized = await sanitizePdfBytes(original);
  } catch (error) {
    logger?.warn?.(
      { err: error, templateFileUrl },
      "PDF sanitize failed; leaving original template in place",
    );
    return { repaired: false, bytes: Buffer.from(original) };
  }

  const same =
    original.length === sanitized.length &&
    Buffer.compare(Buffer.from(original), sanitized) === 0;

  if (same) {
    return { repaired: false, bytes: sanitized };
  }

  const key = keyFromFileUrl(templateFileUrl);
  const storage = await getStorage(prisma);
  await storage.putBuffer({
    key,
    buffer: sanitized,
    contentType: "application/pdf",
  });

  logger?.info?.(
    {
      templateFileUrl,
      beforeBytes: original.length,
      afterBytes: sanitized.length,
    },
    "Rewrote damaged sign-form PDF template for mapper compatibility",
  );

  return { repaired: true, bytes: sanitized };
}

module.exports = {
  TOLERANT_PDF_LOAD,
  loadPdfDocument,
  looksLikePdf,
  sanitizePdfBytes,
  repairStoredPdfTemplate,
};
