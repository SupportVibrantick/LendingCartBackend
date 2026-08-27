const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  evaluateConditionals,
  isFieldRequiredNow,
} = require("../../services/documents/signForm/conditionals");
const {
  computeProgress,
  missingRequiredFields,
} = require("../../services/documents/signForm/submissionService");
const {
  pdfRectToCss,
  cssBoxToPdfRect,
} = require("../../services/documents/signForm/coords");
const {
  expandTableToFields,
} = require("../../services/documents/signForm/tableFields");
const {
  assertSignFormLimits,
  getSignFormLimits,
} = require("../../services/documents/signForm/limits");
const {
  flattenFieldsOntoPdf,
} = require("../../services/documents/signForm/flattenForm");
const {
  signFormSchemaJsonSchema,
} = require("../../schemas/documents/signForm.schema");

test("coordinate round-trip preserves PDF rect", () => {
  const pageHeight = 792;
  const scale = 1.25;
  const original = { x: 120.5, y: 400.25, width: 180, height: 22 };
  const css = pdfRectToCss(original, pageHeight, scale);
  const back = cssBoxToPdfRect(css, pageHeight, scale);
  assert.ok(Math.abs(back.x - original.x) < 0.001);
  assert.ok(Math.abs(back.y - original.y) < 0.001);
  assert.ok(Math.abs(back.width - original.width) < 0.001);
  assert.ok(Math.abs(back.height - original.height) < 0.001);
});

test("conditionals hide and require follow-up fields", () => {
  const schema = {
    fields: [
      {
        id: "1",
        key: "has_affiliates",
        label: "Has affiliates?",
        type: "checkbox",
        page: 1,
        rect: { x: 1, y: 1, width: 10, height: 10 },
        required: true,
        fillRole: "client",
      },
      {
        id: "2",
        key: "affiliate_details",
        label: "Details",
        type: "text",
        page: 1,
        rect: { x: 1, y: 1, width: 10, height: 10 },
        required: false,
        fillRole: "client",
      },
      {
        id: "3",
        key: "affiliate_initial",
        label: "Initial",
        type: "initial",
        page: 1,
        rect: { x: 1, y: 1, width: 10, height: 10 },
        required: false,
        fillRole: "client",
      },
    ],
    conditionals: [
      {
        when: { field: "has_affiliates", equals: true },
        show: ["affiliate_details", "affiliate_initial"],
        require: ["affiliate_details", "affiliate_initial"],
      },
    ],
  };

  const hidden = evaluateConditionals(schema, { has_affiliates: false });
  assert.equal(hidden.hiddenKeys.has("affiliate_details"), true);

  const shown = evaluateConditionals(schema, { has_affiliates: true });
  assert.equal(shown.hiddenKeys.has("affiliate_details"), false);
  assert.equal(isFieldRequiredNow(schema.fields[1], shown), true);

  const progressHidden = computeProgress(schema, { has_affiliates: true });
  assert.equal(progressHidden.client.complete, false);

  const progressDone = computeProgress(schema, {
    has_affiliates: true,
    affiliate_details: "Acme LLC",
    affiliate_initial: "data:image/png;base64,aaa",
  });
  assert.equal(progressDone.client.complete, true);

  const missing = missingRequiredFields(
    schema,
    { has_affiliates: true },
    "client",
  );
  assert.equal(missing.length, 2);
});

test("expandTableToFields creates unique keys", () => {
  const fields = expandTableToFields({
    id: "owners",
    label: "Owners",
    page: 1,
    rows: 2,
    columns: [
      { key: "name", label: "Name" },
      { key: "pct", label: "%" },
    ],
    originRect: { x: 72, y: 500, width: 100, height: 18 },
  });
  assert.equal(fields.length, 4);
  assert.equal(fields[0].key, "owners_r1_name");
  assert.equal(fields[3].key, "owners_r2_pct");
});

test("schema rejects forms over field limit", () => {
  const limits = getSignFormLimits();
  const fields = Array.from({ length: limits.maxFields + 1 }, (_, index) => ({
    id: `fld_${index}`,
    key: `field_${index}`,
    label: `Field ${index}`,
    type: "text",
    page: 1,
    rect: { x: 10, y: 10, width: 40, height: 16 },
  }));

  assert.throws(() =>
    signFormSchemaJsonSchema.parse({
      schemaVersion: 1,
      pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
      fields,
    }),
  );

  assert.throws(() =>
    assertSignFormLimits({
      pages: [{ page: 1 }],
      fields,
      conditionals: [],
      tables: [],
    }),
  );
});

test("flattenFieldsOntoPdf draws text values", async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Borrower", {
    x: 72,
    y: 700,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  const bytes = await pdfDoc.save();
  const tmp = path.join(os.tmpdir(), `sign-form-flatten-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, bytes);

  try {
    const out = await flattenFieldsOntoPdf({
      templatePath: tmp,
      schema: {
        fields: [
          {
            key: "borrower_name",
            type: "text",
            page: 1,
            rect: { x: 160, y: 690, width: 200, height: 20 },
          },
        ],
      },
      values: { borrower_name: "Jane Doe" },
    });
    assert.ok(Buffer.isBuffer(out));
    assert.ok(out.length > 100);
    const hex = Buffer.from("Jane Doe", "utf8").toString("hex").toUpperCase();
    assert.ok(
      inflatedStreamsInclude(out, hex) || inflatedStreamsInclude(out, "Jane Doe"),
      "flattened PDF should contain drawn field value",
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("flattenFieldsOntoPdf fills AcroForm then shows values (not empty widgets)", async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  const textField = form.createTextField("Applicant Business Legal Name");
  textField.addToPage(page, {
    x: 160,
    y: 690,
    width: 280,
    height: 20,
  });
  const checkbox = form.createCheckBox("Special Ownership Other");
  checkbox.addToPage(page, {
    x: 72,
    y: 650,
    width: 12,
    height: 12,
  });
  const bytes = await pdfDoc.save();
  const tmp = path.join(os.tmpdir(), `sign-form-acro-flatten-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, bytes);

  try {
    const out = await flattenFieldsOntoPdf({
      templatePath: tmp,
      schema: {
        fields: [
          {
            key: "Applicant_Business_Legal_Name",
            label: "Applicant Business Legal Name",
            type: "text",
            page: 1,
            rect: { x: 160, y: 690, width: 280, height: 20 },
            meta: { detectedLabel: "Applicant Business Legal Name", source: "acroform" },
          },
          {
            key: "Special_Ownership_Other",
            label: "Special Ownership Other",
            type: "checkbox",
            page: 1,
            rect: { x: 72, y: 650, width: 12, height: 12 },
            meta: { detectedLabel: "Special Ownership Other", source: "acroform" },
          },
        ],
      },
      values: {
        Applicant_Business_Legal_Name: "Acme Lending LLC",
        Special_Ownership_Other: true,
      },
    });

    assert.ok(Buffer.isBuffer(out));
    const hex = Buffer.from("Acme Lending LLC", "utf8").toString("hex").toUpperCase();
    assert.ok(
      inflatedStreamsInclude(out, hex) || inflatedStreamsInclude(out, "Acme Lending LLC"),
      "filled AcroForm export must contain text value in page content",
    );

    const reloaded = await PDFDocument.load(out, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    let remainingFields = [];
    try {
      remainingFields = reloaded.getForm().getFields();
    } catch {
      remainingFields = [];
    }
    assert.equal(
      remainingFields.length,
      0,
      "exported PDF should not leave empty interactive AcroForm widgets",
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("flattenFieldsOntoPdf only marks checked checkboxes (no X on all boxes)", async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  form.createCheckBox("Entity Sole").addToPage(page, {
    x: 72,
    y: 700,
    width: 12,
    height: 12,
  });
  form.createCheckBox("Entity LLC").addToPage(page, {
    x: 72,
    y: 680,
    width: 12,
    height: 12,
  });
  form.createCheckBox("Entity Other").addToPage(page, {
    x: 72,
    y: 660,
    width: 12,
    height: 12,
  });
  // Pre-check all native widgets — export must not bake these as crosses.
  form.getCheckBox("Entity Sole").check();
  form.getCheckBox("Entity LLC").check();
  form.getCheckBox("Entity Other").check();

  const bytes = await pdfDoc.save();
  const tmp = path.join(os.tmpdir(), `sign-form-cb-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, bytes);

  try {
    const out = await flattenFieldsOntoPdf({
      templatePath: tmp,
      schema: {
        fields: [
          {
            key: "Entity_Sole",
            type: "checkbox",
            page: 1,
            rect: { x: 72, y: 700, width: 12, height: 12 },
            meta: { detectedLabel: "Entity Sole", source: "acroform" },
          },
          {
            key: "Entity_LLC",
            type: "checkbox",
            page: 1,
            rect: { x: 72, y: 680, width: 12, height: 12 },
            meta: { detectedLabel: "Entity LLC", source: "acroform" },
          },
          {
            key: "Entity_Other",
            type: "checkbox",
            page: 1,
            rect: { x: 72, y: 660, width: 12, height: 12 },
            meta: { detectedLabel: "Entity Other", source: "acroform" },
          },
        ],
      },
      values: {
        Entity_Sole: false,
        Entity_LLC: true,
        Entity_Other: "false",
      },
    });

    const reloaded = await PDFDocument.load(out, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    assert.equal(reloaded.getForm().getFields().length, 0);

    const { isCheckboxChecked } = require("../../services/documents/signForm/flattenForm");
    assert.equal(isCheckboxChecked(true), true);
    assert.equal(isCheckboxChecked(false), false);
    assert.equal(isCheckboxChecked("false"), false);
    assert.equal(isCheckboxChecked("No"), false);
    assert.equal(isCheckboxChecked(1), true);
    assert.equal(isCheckboxChecked("yes"), true);

    // Checked overlay uses stroke lines (`l` / path ops), not a literal (X) Tj text draw.
    assert.equal(
      inflatedStreamsInclude(out, "(X) Tj"),
      false,
      "export must not draw literal X text for checkboxes",
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});

function inflatedStreamsInclude(pdfBytes, needle) {
  const zlib = require("zlib");
  const buf = Buffer.from(pdfBytes);
  let pos = 0;
  const upperNeedle = String(needle).toUpperCase();
  while (pos < buf.length) {
    const streamIdx = buf.indexOf(Buffer.from("stream"), pos);
    if (streamIdx < 0) break;
    let dataStart = streamIdx + 6;
    if (buf[dataStart] === 0x0d) dataStart += 1;
    if (buf[dataStart] === 0x0a) dataStart += 1;
    const endIdx = buf.indexOf(Buffer.from("endstream"), dataStart);
    if (endIdx < 0) break;
    let data = buf.subarray(dataStart, endIdx);
    if (data[data.length - 1] === 0x0a) data = data.subarray(0, data.length - 1);
    if (data[data.length - 1] === 0x0d) data = data.subarray(0, data.length - 1);
    try {
      const text = zlib.inflateSync(data).toString("latin1");
      if (text.includes(needle) || text.toUpperCase().includes(upperNeedle)) {
        return true;
      }
    } catch {
      // not a flate stream
    }
    pos = endIdx + 9;
  }
  return false;
}
