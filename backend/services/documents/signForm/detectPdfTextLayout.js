const fs = require("fs");
const { lineToCandidateField } = require("./ocrHeuristics");

async function loadPdfJs() {
  // pdfjs-dist v4 ESM build; works from CommonJS via dynamic import.
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

function groupTextItemsIntoLines(items, pageHeightPt) {
  const rows = [];
  for (const item of items) {
    const str = String(item.str || "").trim();
    if (!str) continue;
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    const width = Number(item.width) || Math.max(8, str.length * 5);
    const height = Math.abs(transform[3]) || 10;

    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 4);
    if (!row) {
      rows.push({
        y,
        parts: [{ str, x, y, width, height }],
      });
      continue;
    }
    row.parts.push({ str, x, y, width, height });
  }

  return rows
    .map((row) => {
      const parts = row.parts.sort((a, b) => a.x - b.x);
      const minX = Math.min(...parts.map((p) => p.x));
      const maxX = Math.max(...parts.map((p) => p.x + p.width));
      const minY = Math.min(...parts.map((p) => p.y));
      const maxY = Math.max(...parts.map((p) => p.y + p.height));
      return {
        content: parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim(),
        rect: {
          x: minX,
          y: minY,
          width: Math.max(8, maxX - minX),
          height: Math.max(8, maxY - minY),
        },
        pageHeightPt,
      };
    })
    .filter((line) => line.content);
}

/**
 * Free detector for digital PDFs using embedded text positions (no API key).
 */
async function detectPdfTextLayoutFields({
  filePath,
  pageManifest,
  maxPages = 20,
}) {
  if (!fs.existsSync(filePath)) {
    return {
      fields: [],
      provider: "pdf_text",
      skipped: true,
      note: "PDF file not found",
    };
  }

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages || 0, maxPages);
  const detected = [];
  let counter = 1;
  let lineCount = 0;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const manifest = (pageManifest || []).find((p) => p.page === pageNumber);
    const pageWidthPt = manifest?.widthPt || viewport.width || 612;
    const pageHeightPt = manifest?.heightPt || viewport.height || 792;
    const content = await page.getTextContent();
    const lines = groupTextItemsIntoLines(content.items || [], pageHeightPt);
    lineCount += lines.length;

    for (const line of lines) {
      const field = lineToCandidateField({
        content: line.content,
        rect: {
          x: Math.max(0, Math.min(line.rect.x, pageWidthPt - 4)),
          y: Math.max(0, Math.min(line.rect.y, pageHeightPt - 4)),
          width: Math.min(line.rect.width, pageWidthPt),
          height: Math.min(line.rect.height, pageHeightPt),
        },
        page: pageNumber,
        counter,
        source: "pdf_text",
        confidence: 0.72,
      });
      if (!field) continue;
      detected.push(field);
      counter += 1;
      if (detected.length >= 200) break;
    }
    if (detected.length >= 200) break;
  }

  return {
    fields: detected,
    provider: "pdf_text",
    skipped: false,
    note: detected.length
      ? `Free PDF text layout suggested ${detected.length} fields`
      : lineCount
        ? "PDF text found, but no fill-in cues matched"
        : "Little or no extractable PDF text (likely scanned). Upload as image or enable Azure.",
    rawSummary: {
      pageCount,
      lines: lineCount,
    },
  };
}

module.exports = {
  detectPdfTextLayoutFields,
  groupTextItemsIntoLines,
};
