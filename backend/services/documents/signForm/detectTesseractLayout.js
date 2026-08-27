const fs = require("fs");
const path = require("path");
const { lineToCandidateField } = require("./ocrHeuristics");

function isTesseractEnabled() {
  const raw = process.env.SIGN_FORM_TESSERACT;
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

function getTesseractLang() {
  return (process.env.SIGN_FORM_TESSERACT_LANG || "eng").trim() || "eng";
}

/**
 * Free detector for image templates using Tesseract.js (no API key).
 * Coordinates are in image pixels treated as PDF points (matches pageManifest).
 */
async function detectTesseractLayoutFields({
  filePath,
  pageManifest,
}) {
  if (!isTesseractEnabled()) {
    return {
      fields: [],
      provider: "tesseract",
      skipped: true,
      note: "Tesseract OCR is disabled (SIGN_FORM_TESSERACT=false)",
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      fields: [],
      provider: "tesseract",
      skipped: true,
      note: "Image file not found",
    };
  }

  let createWorker;
  try {
    ({ createWorker } = require("tesseract.js"));
  } catch {
    return {
      fields: [],
      provider: "tesseract",
      skipped: true,
      note: "tesseract.js is not installed",
    };
  }

  const manifest = (pageManifest || [])[0] || {};
  const pageWidthPt = manifest.widthPt || 612;
  const pageHeightPt = manifest.heightPt || 792;

  const worker = await createWorker(getTesseractLang(), 1, {
    logger: () => {},
  });

  try {
    const result = await worker.recognize(filePath);
    const data = result?.data || {};
    const imageWidth = data.imageWidth || pageWidthPt;
    const imageHeight = data.imageHeight || pageHeightPt;
    const scaleX = pageWidthPt / imageWidth;
    const scaleY = pageHeightPt / imageHeight;

    const lines = Array.isArray(data.lines) ? data.lines : [];
    const detected = [];
    let counter = 1;

    for (const line of lines) {
      const content = String(line.text || "").trim();
      if (!content) continue;
      const box = line.bbox || {};
      const x0 = Number(box.x0) || 0;
      const y0 = Number(box.y0) || 0;
      const x1 = Number(box.x1) || x0 + 40;
      const y1 = Number(box.y1) || y0 + 14;

      // Tesseract Y is top-left; convert to PDF bottom-left.
      const width = Math.max(8, (x1 - x0) * scaleX);
      const height = Math.max(8, (y1 - y0) * scaleY);
      const x = x0 * scaleX;
      const top = y0 * scaleY;
      const y = pageHeightPt - top - height;

      const confidence =
        typeof line.confidence === "number"
          ? Math.max(0, Math.min(1, line.confidence / 100))
          : 0.6;

      const field = lineToCandidateField({
        content,
        rect: {
          x: Math.max(0, Math.min(x, pageWidthPt - 4)),
          y: Math.max(0, Math.min(y, pageHeightPt - 4)),
          width: Math.min(width, pageWidthPt),
          height: Math.min(height, pageHeightPt),
        },
        page: 1,
        counter,
        source: "tesseract",
        confidence,
      });
      if (!field) continue;
      detected.push(field);
      counter += 1;
      if (detected.length >= 200) break;
    }

    return {
      fields: detected,
      provider: "tesseract",
      skipped: false,
      note: detected.length
        ? `Tesseract OCR suggested ${detected.length} fields`
        : "Tesseract found no fill-in cues",
      rawSummary: {
        lines: lines.length,
        imageWidth,
        imageHeight,
      },
    };
  } finally {
    try {
      await worker.terminate();
    } catch {
      // ignore
    }
  }
}

function isImagePath(filePath, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const ext = path.extname(filePath || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"].includes(
    ext,
  );
}

module.exports = {
  detectTesseractLayoutFields,
  isTesseractEnabled,
  isImagePath,
  getTesseractLang,
};
