const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  looksLikeFillCue,
  inferFieldType,
  lineToCandidateField,
  isFreeOcrEnabled,
} = require("../../services/documents/signForm/ocrHeuristics");
const {
  groupTextItemsIntoLines,
} = require("../../services/documents/signForm/detectPdfTextLayout");

test("looksLikeFillCue matches underlines and labels", () => {
  assert.equal(looksLikeFillCue("Borrower Name: ________"), true);
  assert.equal(looksLikeFillCue("Signature"), true);
  assert.equal(looksLikeFillCue("☐ Married"), true);
  assert.equal(looksLikeFillCue("Hello world"), false);
});

test("inferFieldType maps common cues", () => {
  assert.equal(inferFieldType("Email Address"), "email");
  assert.equal(inferFieldType("Date of Birth"), "date");
  assert.equal(inferFieldType("Loan Amount $"), "currency");
  assert.equal(inferFieldType("Borrower Signature"), "signature");
  assert.equal(inferFieldType("☐ Yes"), "checkbox");
});

test("lineToCandidateField builds overlay field", () => {
  const field = lineToCandidateField({
    content: "Borrower Name: ____________",
    rect: { x: 72, y: 500, width: 40, height: 12 },
    page: 1,
    counter: 3,
    source: "pdf_text",
    confidence: 0.8,
  });
  assert.ok(field);
  assert.equal(field.type, "text");
  assert.equal(field.meta.source, "pdf_text");
  assert.ok(field.rect.width >= 160);
});

test("groupTextItemsIntoLines merges same-row tokens", () => {
  const lines = groupTextItemsIntoLines(
    [
      { str: "Borrower", width: 40, transform: [1, 0, 0, 10, 72, 500] },
      { str: "Name", width: 30, transform: [1, 0, 0, 10, 120, 501] },
      { str: "____", width: 80, transform: [1, 0, 0, 10, 160, 500] },
      { str: "Date", width: 30, transform: [1, 0, 0, 10, 72, 450] },
    ],
    792,
  );
  assert.equal(lines.length, 2);
  assert.match(lines[0].content, /Borrower/);
});

test("isFreeOcrEnabled defaults true", () => {
  const previous = process.env.SIGN_FORM_FREE_OCR;
  delete process.env.SIGN_FORM_FREE_OCR;
  assert.equal(isFreeOcrEnabled(), true);
  process.env.SIGN_FORM_FREE_OCR = "false";
  assert.equal(isFreeOcrEnabled(), false);
  if (previous === undefined) delete process.env.SIGN_FORM_FREE_OCR;
  else process.env.SIGN_FORM_FREE_OCR = previous;
});
