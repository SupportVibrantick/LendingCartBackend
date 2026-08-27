const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const {
  mergeDetectedFields,
  iou,
} = require("../../services/documents/signForm/detectFields.service");
const {
  detectAcroFormFields,
} = require("../../services/documents/signForm/detectAcroForm");
const {
  polygonToRect,
} = require("../../services/documents/signForm/detectAzureLayout");
const {
  extractJsonObject,
} = require("../../services/documents/signForm/refineWithLlm");
const {
  signFormSchemaJsonSchema,
  analyzeSignFormSchema,
} = require("../../schemas/documents/signForm.schema");

test("iou detects overlapping rectangles", () => {
  const a = { x: 0, y: 0, width: 100, height: 40 };
  const b = { x: 50, y: 0, width: 100, height: 40 };
  assert.ok(iou(a, b) > 0.3);
  assert.equal(iou(a, { x: 200, y: 200, width: 10, height: 10 }), 0);
});

test("mergeDetectedFields keeps higher confidence on overlap", () => {
  const merged = mergeDetectedFields([
    [
      {
        id: "a",
        key: "name",
        label: "Name",
        type: "text",
        page: 1,
        rect: { x: 10, y: 10, width: 100, height: 20 },
        meta: { confidence: 0.6, source: "azure_layout" },
      },
    ],
    [
      {
        id: "b",
        key: "borrower_name",
        label: "Borrower Name",
        type: "text",
        page: 1,
        rect: { x: 12, y: 12, width: 100, height: 20 },
        meta: { confidence: 0.95, source: "acroform" },
      },
    ],
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].meta.source, "acroform");
  assert.equal(merged[0].key, "borrower_name");
});

test("mergeDetectedFields keeps non-overlapping fields", () => {
  const merged = mergeDetectedFields([
    [
      {
        id: "a",
        key: "name",
        label: "Name",
        type: "text",
        page: 1,
        rect: { x: 10, y: 10, width: 80, height: 20 },
        meta: { confidence: 0.9, source: "acroform" },
      },
      {
        id: "b",
        key: "date",
        label: "Date",
        type: "date",
        page: 1,
        rect: { x: 200, y: 400, width: 80, height: 20 },
        meta: { confidence: 0.7, source: "azure_layout" },
      },
    ],
  ]);
  assert.equal(merged.length, 2);
});

test("detectAcroFormFields extracts text widgets", async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const field = form.createTextField("BorrowerName");
  field.setText("");
  field.addToPage(page, {
    x: 100,
    y: 500,
    width: 200,
    height: 24,
    font,
  });

  const bytes = await pdfDoc.save();
  const result = await detectAcroFormFields(bytes);
  assert.ok(result.fields.length >= 1);
  assert.equal(result.fields[0].type, "text");
  assert.equal(result.fields[0].meta.source, "acroform");
  assert.ok(result.fields[0].rect.width > 0);
});

test("polygonToRect converts Azure top-left inches to PDF bottom-left points", () => {
  const rect = polygonToRect(
    [1, 1, 3, 1, 3, 1.5, 1, 1.5],
    612,
    792,
    "inch",
  );
  assert.ok(rect);
  assert.equal(rect.x, 72);
  assert.equal(rect.width, 144);
  assert.equal(rect.height, 36);
  // top at 1 inch → y from bottom = 792 - 72 - 36 = 684
  assert.equal(rect.y, 684);
});

test("extractJsonObject recovers JSON from LLM prose", () => {
  const parsed = extractJsonObject(
    'Sure:\n{"fields":[{"id":"fld_1","label":"Name","type":"text"}]}\n',
  );
  assert.equal(parsed.fields[0].label, "Name");
});

test("schema accepts detection report on draft", () => {
  const parsed = signFormSchemaJsonSchema.parse({
    schemaVersion: 1,
    pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
    fields: [
      {
        id: "fld_1",
        key: "borrower_name",
        label: "Borrower Name",
        type: "text",
        page: 1,
        rect: { x: 10, y: 10, width: 100, height: 20 },
        meta: {
          confidence: 0.92,
          source: "acroform",
          llmRefined: true,
        },
      },
    ],
    detection: {
      ranAt: new Date().toISOString(),
      fieldCount: 1,
      providers: [{ provider: "acroform", fieldCount: 1, note: "ok" }],
      capabilities: { azureConfigured: false, llmConfigured: false },
    },
  });
  assert.equal(parsed.detection.fieldCount, 1);
});

test("analyzeSignFormSchema defaults", () => {
  const parsed = analyzeSignFormSchema.parse({});
  assert.equal(parsed.replaceExisting, false);
  assert.equal(parsed.useAzure, true);
  assert.equal(parsed.useLlm, true);
});
