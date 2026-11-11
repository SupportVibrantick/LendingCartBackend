const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const {
  looksLikePdf,
  sanitizePdfBytes,
  loadPdfDocument,
} = require("../../services/documents/signForm/pdfLoad");
const {
  collectPageWidgetAnnots,
} = require("../../services/documents/signForm/detectAcroForm");

const CELTIC_FIXTURE = path.join(
  __dirname,
  "../fixtures/celtic-invalid-xref.pdf",
);

async function buildFillablePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const nameField = form.createTextField("BorrowerName");
  nameField.addToPage(page, { x: 100, y: 500, width: 200, height: 24, font });
  return Buffer.from(await pdfDoc.save());
}

test("looksLikePdf rejects non-pdf bytes", () => {
  assert.equal(looksLikePdf(Buffer.from("not a pdf")), false);
  assert.equal(looksLikePdf(Buffer.from("%PDF-1.7")), true);
});

test("sanitizePdfBytes keeps healthy AcroForm widgets", async () => {
  const original = await buildFillablePdf();
  const sanitized = await sanitizePdfBytes(original);
  assert.equal(looksLikePdf(sanitized), true);
  const doc = await loadPdfDocument(sanitized);
  assert.equal(doc.getPageCount(), 1);
  const { widgets } = collectPageWidgetAnnots(doc);
  assert.ok(widgets.length >= 1);
});

test("sanitizePdfBytes repairs Celtic/LiveCycle broken xref so pdf-lib can reload", async (t) => {
  if (!fs.existsSync(CELTIC_FIXTURE)) {
    t.skip("celtic-invalid-xref.pdf fixture missing");
    return;
  }

  const original = fs.readFileSync(CELTIC_FIXTURE);
  const sanitized = await sanitizePdfBytes(original);
  assert.equal(looksLikePdf(sanitized), true);
  assert.notEqual(sanitized.length, original.length);

  const doc = await PDFDocument.load(sanitized);
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPages()[0].getSize();
  assert.equal(Math.round(width), 792);
  assert.equal(Math.round(height), 612);

  const { widgets } = collectPageWidgetAnnots(doc);
  assert.ok(
    widgets.length >= 80,
    `expected recovered widgets, got ${widgets.length}`,
  );
});
