/** Shared LOI PDF layout constants (PDFKit top-left origin). */
const LOI_PAGE = {
  width: 612,
  height: 792,
  margin: 44,
  bottom: 44,
};

const LOI_CONTENT_BOTTOM = LOI_PAGE.height - LOI_PAGE.bottom;

function getPdfKitCurrentPageIndex(doc) {
  const range = doc.bufferedPageRange();
  return range.start + range.count - 1;
}

/** Build anchor metadata for client signature placement during PDF merge. */
function buildLoiSignatureAnchor(doc, options = {}) {
  const {
    boxTop,
    boxWidth,
    lineY,
    sigX = LOI_PAGE.margin + 10,
    sigTopY,
    sigWidth = Math.min(220, boxWidth * 0.45),
    sigHeight = 36,
    dateX = LOI_PAGE.margin + boxWidth * 0.58,
    printNameY = lineY + 6,
  } = options;

  return {
    page: getPdfKitCurrentPageIndex(doc),
    lineY,
    margin: LOI_PAGE.margin,
    boxWidth,
    boxTop,
    sigX,
    sigTopY: sigTopY != null ? sigTopY : lineY - sigHeight - 2,
    sigWidth,
    sigHeight,
    dateX,
    printNameY,
  };
}

/** Fallback when older LOI PDFs lack embedded anchor metadata. */
function estimateLoiSignatureAnchor(pageHeight, pageWidth) {
  const margin = LOI_PAGE.margin;
  const contentBottom = pageHeight - LOI_PAGE.bottom;
  const boxWidth = pageWidth - margin * 2;
  const boxHeight = 110;
  const boxTop = contentBottom - boxHeight - 8;
  const padding = 8;
  const titleH = 14;
  const disclaimerH = 22;
  const sigHeight = 36;
  const sigTopY = boxTop + padding + titleH + 4 + disclaimerH + 8;
  const lineY = sigTopY + sigHeight + 2;
  const sigWidth = Math.min(220, boxWidth * 0.45);

  return {
    page: -1,
    lineY,
    margin,
    boxWidth,
    boxTop,
    sigX: margin + 10,
    sigTopY,
    sigWidth,
    sigHeight,
    dateX: margin + boxWidth * 0.58,
    printNameY: lineY + 6,
  };
}

/** Convert PDFKit Y (top-down) to pdf-lib Y (bottom-up). */
function pdfKitYToPdfLibY(pageHeight, yFromTop) {
  return pageHeight - yFromTop;
}

module.exports = {
  LOI_PAGE,
  LOI_CONTENT_BOTTOM,
  getPdfKitCurrentPageIndex,
  buildLoiSignatureAnchor,
  estimateLoiSignatureAnchor,
  pdfKitYToPdfLibY,
};
