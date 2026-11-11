const { PDFDocument } = require("pdf-lib");

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

module.exports = {
  TOLERANT_PDF_LOAD,
  loadPdfDocument,
};
