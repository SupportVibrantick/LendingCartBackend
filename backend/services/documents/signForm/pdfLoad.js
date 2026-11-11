const { PDFDocument, PDFName } = require("pdf-lib");
const { getStorage, keyFromFileUrl, getBufferFromRef } = require("../../storage");

/** Options that tolerate LiveCycle / SBA / damaged AcroForm PDFs. */
const TOLERANT_PDF_LOAD = {
  ignoreEncryption: true,
  throwOnInvalidObject: false,
  updateMetadata: false,
};

const PRODUCER_MARK = "LendingCart-pdf-sanitize";
const MAX_SANITIZE_BYTES = 25 * 1024 * 1024;

/**
 * Load a PDF with tolerant parse options.
 * Strict pdf-lib loads fail on many production SBA templates
 * ("Failed to parse invalid PDF object").
 */
async function loadPdfDocument(bytes, extra = {}) {
  try {
    return await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      ...extra,
    });
  } catch {
    return PDFDocument.load(bytes, {
      ...TOLERANT_PDF_LOAD,
      ...extra,
    });
  }
}

function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const head = Buffer.from(bytes).subarray(0, 5).toString("latin1");
  return head === "%PDF-";
}

function isInvalidPdfObject(obj) {
  return Boolean(obj) && obj.constructor && obj.constructor.name === "PDFInvalidObject";
}

/**
 * Celtic/LiveCycle files often have one truncated object (e.g. `621 0 R`)
 * whose payload still contains /Rect and /T. Rebuild a minimal widget dict
 * so pdf-lib can save and Chrome/pdf.js can open the file.
 */
function recoverInvalidObjectDict(pdfDoc, invalidObj) {
  const raw = invalidObj?.data;
  const text = raw
    ? Buffer.from(raw).toString("latin1")
    : "";
  const rectMatch = text.match(
    /\/Rect\s*\[\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*\]/,
  );
  const nameMatch = text.match(/\/T\s*\(([^\\)]*)\)/);
  const dict = {
    Type: "Annot",
    Subtype: "Widget",
    F: 4,
    Rect: rectMatch
      ? [
          Number(rectMatch[1]),
          Number(rectMatch[2]),
          Number(rectMatch[3]),
          Number(rectMatch[4]),
        ]
      : [0, 0, 1, 1],
  };
  if (nameMatch) dict.T = nameMatch[1];
  return pdfDoc.context.obj(dict);
}

function replaceInvalidObjects(pdfDoc) {
  let replaced = 0;
  const objects = pdfDoc.context.enumerateIndirectObjects();
  for (const [ref, obj] of objects) {
    if (!isInvalidPdfObject(obj)) continue;
    pdfDoc.context.assign(ref, recoverInvalidObjectDict(pdfDoc, obj));
    replaced += 1;
  }
  return replaced;
}

function stripBrokenFormTrees(pdfDoc) {
  try {
    pdfDoc.catalog.delete(PDFName.of("AcroForm"));
  } catch {
    // ignore
  }
  for (const page of pdfDoc.getPages()) {
    try {
      page.node.delete(PDFName.of("Annots"));
    } catch {
      // ignore
    }
  }
}

async function saveSanitized(pdfDoc) {
  try {
    pdfDoc.setProducer(PRODUCER_MARK);
  } catch {
    // ignore
  }
  const out = await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
  return Buffer.from(out);
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

  if (bytes.length > MAX_SANITIZE_BYTES) {
    return Buffer.from(bytes);
  }

  const pdfDoc = await loadPdfDocument(bytes, { throwOnInvalidObject: false });
  try {
    if (String(pdfDoc.getProducer() || "").includes(PRODUCER_MARK)) {
      return Buffer.from(bytes);
    }
  } catch {
    // continue
  }

  const replaced = replaceInvalidObjects(pdfDoc);
  if (replaced === 0) {
    // Healthy PDFs: do not rewrite on every /uploads hit.
    return Buffer.from(bytes);
  }

  try {
    return await saveSanitized(pdfDoc);
  } catch {
    try {
      stripBrokenFormTrees(pdfDoc);
      return await saveSanitized(pdfDoc);
    } catch {
      const rebuilt = await PDFDocument.create();
      const copied = await rebuilt.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copied.forEach((page) => rebuilt.addPage(page));
      return saveSanitized(rebuilt);
    }
  }
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
