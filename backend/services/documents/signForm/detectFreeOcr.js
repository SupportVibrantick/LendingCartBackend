const {
  detectPdfTextLayoutFields,
} = require("./detectPdfTextLayout");
const {
  detectTesseractLayoutFields,
  isImagePath,
  isTesseractEnabled,
} = require("./detectTesseractLayout");
const { isFreeOcrEnabled } = require("./ocrHeuristics");
const { getSignFormLimits } = require("./limits");

/**
 * Free OCR / layout assist (no cloud API key).
 * - Digital PDFs: embedded text positions via pdf.js
 * - Images: Tesseract.js
 * - Scanned PDFs with no text: returns guidance note (use image upload or Azure)
 */
async function detectFreeOcrFields({
  filePath,
  mimeType,
  pageManifest,
  isPdf,
}) {
  if (!isFreeOcrEnabled()) {
    return {
      fields: [],
      provider: "free_ocr",
      skipped: true,
      note: "Free OCR is disabled (SIGN_FORM_FREE_OCR=false)",
    };
  }

  const limits = getSignFormLimits();

  if (isPdf) {
    const pdfText = await detectPdfTextLayoutFields({
      filePath,
      pageManifest,
      maxPages: limits.maxPages,
    });

    // If text layer is rich enough, use it.
    if ((pdfText.fields || []).length > 0 || (pdfText.rawSummary?.lines || 0) > 8) {
      return {
        ...pdfText,
        provider: "free_ocr",
        note: pdfText.note,
        parts: [pdfText],
      };
    }

    return {
      fields: [],
      provider: "free_ocr",
      skipped: false,
      note:
        pdfText.note ||
        "Scanned PDF has little extractable text. Re-upload as PNG/JPEG for free Tesseract OCR, or configure Azure.",
      parts: [pdfText],
    };
  }

  if (isImagePath(filePath, mimeType)) {
    const tess = await detectTesseractLayoutFields({
      filePath,
      pageManifest,
    });
    return {
      ...tess,
      provider: "free_ocr",
      parts: [tess],
    };
  }

  return {
    fields: [],
    provider: "free_ocr",
    skipped: true,
    note: "Unsupported file type for free OCR",
  };
}

function getFreeOcrCapabilities() {
  return {
    freeOcrEnabled: isFreeOcrEnabled(),
    tesseractEnabled: isTesseractEnabled(),
    pdfTextEnabled: isFreeOcrEnabled(),
  };
}

module.exports = {
  detectFreeOcrFields,
  getFreeOcrCapabilities,
};
