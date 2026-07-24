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
function buildLoiSignatureAnchor(doc, boxTop, boxWidth, lineY) {
  return {
    page: getPdfKitCurrentPageIndex(doc),
    lineY,
    margin: LOI_PAGE.margin,
    boxWidth,
    boxTop,
    dateX: LOI_PAGE.margin + 12 + boxWidth * 0.58,
    printNameY: lineY + 16,
  };
}

/** Fallback when older LOI PDFs lack embedded anchor metadata. */
function estimateLoiSignatureAnchor(pageHeight, pageWidth) {
  const margin = LOI_PAGE.margin;
  const contentBottom = pageHeight - LOI_PAGE.bottom;
  const footerHeight = 43;
  const pinnedFooterY = contentBottom - footerHeight;
  const contentEndY = pinnedFooterY - 16;
  const boxTop = contentEndY - 58;
  const lineY = boxTop + 32;
  const boxWidth = pageWidth - margin * 2;

  return {
    page: -1,
    lineY,
    margin,
    boxWidth,
    boxTop,
    dateX: margin + 12 + boxWidth * 0.58,
    printNameY: lineY + 16,
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
