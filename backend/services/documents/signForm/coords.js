function pdfRectToCss(rect, pageHeightPt, scale) {
  return {
    left: rect.x * scale,
    top: (pageHeightPt - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function cssBoxToPdfRect(box, pageHeightPt, scale) {
  const width = box.width / scale;
  const height = box.height / scale;
  const x = box.left / scale;
  const y = pageHeightPt - box.top / scale - height;
  return { x, y, width, height };
}

module.exports = {
  pdfRectToCss,
  cssBoxToPdfRect,
};
