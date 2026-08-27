const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const {
  prepareAcroFormAutoPublish,
  autoPublishAcroFormIfPresent,
  isPdfTemplate,
} = require("../../services/documents/signForm/autoPublishAcroForm");

async function buildFillablePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const nameField = form.createTextField("BorrowerName");
  nameField.setText("");
  nameField.addToPage(page, {
    x: 100,
    y: 500,
    width: 200,
    height: 24,
    font,
  });

  const tinField = form.createTextField("BusinessTIN");
  tinField.setText("");
  tinField.addToPage(page, {
    x: 100,
    y: 450,
    width: 160,
    height: 24,
    font,
  });

  return Buffer.from(await pdfDoc.save());
}

async function buildPlainPdf() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]);
  return Buffer.from(await pdfDoc.save());
}

function writeTempUpload(pdfBytes, filename) {
  const dir = path.join(process.cwd(), "uploads", "_test_auto_publish");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, pdfBytes);
  return {
    filePath,
    publicUrl: `/uploads/_test_auto_publish/${filename}`,
    cleanup: () => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    },
  };
}

test("isPdfTemplate recognizes pdf mime and extension", () => {
  assert.equal(
    isPdfTemplate({ templateMimeType: "application/pdf" }),
    true,
  );
  assert.equal(isPdfTemplate({ templateFileName: "form.PDF" }), true);
  assert.equal(
    isPdfTemplate({ templateMimeType: "image/png", templateFileName: "x.png" }),
    false,
  );
});

test("prepareAcroFormAutoPublish publishes schema when AcroForm fields exist", async () => {
  const pdfBytes = await buildFillablePdf();
  const prepared = await prepareAcroFormAutoPublish({
    templateMimeType: "application/pdf",
    templateFileName: "sba-form.pdf",
    templateFileUrl: "/uploads/missing-for-test.pdf",
    pdfBytes,
  });

  assert.equal(prepared.ok, true);
  assert.ok(prepared.fieldCount >= 2);
  assert.equal(prepared.schema.schemaVersion, 1);
  assert.ok(prepared.schema.fields.every((f) => f.fillRole === "either"));
  assert.ok(prepared.schema.fields.some((f) => f.type === "text"));
  assert.equal(prepared.schema.detection.autoPublished, true);
  assert.ok(prepared.schema.pages.length >= 1);
});

test("prepareAcroFormAutoPublish no-ops for plain PDF without AcroForm", async () => {
  const pdfBytes = await buildPlainPdf();
  const prepared = await prepareAcroFormAutoPublish({
    templateMimeType: "application/pdf",
    templateFileName: "plain.pdf",
    templateFileUrl: "/uploads/missing-for-test.pdf",
    pdfBytes,
  });

  assert.equal(prepared.ok, false);
  assert.equal(prepared.reason, "no_fields");
});

test("prepareAcroFormAutoPublish no-ops for non-PDF", async () => {
  const prepared = await prepareAcroFormAutoPublish({
    templateMimeType: "image/png",
    templateFileName: "scan.png",
  });
  assert.equal(prepared.ok, false);
  assert.equal(prepared.reason, "not_pdf");
});

test("autoPublishAcroFormIfPresent leaves SIGNATURE_ONLY when no fields", async () => {
  const pdfBytes = await buildPlainPdf();
  const result = await autoPublishAcroFormIfPresent({}, {
    requirement: {
      id: "req_1",
      templateFileUrl: "/uploads/missing.pdf",
      templateMimeType: "application/pdf",
      templateFileName: "plain.pdf",
      signMode: "SIGNATURE_ONLY",
    },
    organizationId: "org_1",
    pdfBytes,
  });

  assert.equal(result.published, false);
  assert.equal(result.signMode, "SIGNATURE_ONLY");
  assert.equal(result.reason, "no_fields");
});

test("autoPublishAcroFormIfPresent publishes DYNAMIC_FORM when fields found", async () => {
  const pdfBytes = await buildFillablePdf();
  const stored = writeTempUpload(pdfBytes, `fillable-${Date.now()}.pdf`);
  const calls = [];

  const prisma = {
    signFormDefinition: {
      findUnique: async () => null,
    },
    signFormVersion: {
      update: async ({ where, data }) => ({
        id: where.id || "ver_1",
        status: "DRAFT",
        version: 1,
        schemaJson: data.schemaJson,
        pageManifestJson: data.pageManifestJson,
        formDefinitionId: "def_1",
        formDefinition: {
          id: "def_1",
          requirementId: "req_1",
          title: "SBA Form",
          status: "DRAFT",
        },
      }),
    },
    applicationDocumentRequirement: {
      findUnique: async () => ({
        id: "req_1",
        signMode: "SIGNATURE_ONLY",
        formProcessingStatus: "READY",
        activeFormVersionId: null,
        templateFileUrl: stored.publicUrl,
        templateMimeType: "application/pdf",
        templateFileName: "fillable.pdf",
      }),
      update: async ({ data }) => ({ id: "req_1", ...data }),
    },
    $transaction: async (fn) =>
      fn({
        signFormDefinition: {
          create: async ({ data }) => {
            calls.push(["createDefinition", data]);
            return { id: "def_1", ...data };
          },
          findUnique: async () => ({
            id: "def_1",
            versions: [
              {
                id: "ver_1",
                version: 1,
                status: "DRAFT",
                schemaJson: { fields: [] },
                pageManifestJson: [],
              },
            ],
          }),
          update: async ({ data }) => {
            calls.push(["updateDefinition", data]);
            return { id: "def_1", ...data };
          },
        },
        signFormVersion: {
          create: async ({ data }) => {
            calls.push(["createVersion", data]);
            return { id: "ver_1", ...data };
          },
          update: async ({ where, data }) => {
            calls.push(["publishVersion", data]);
            return {
              id: where.id,
              ...data,
              formDefinitionId: "def_1",
              formDefinition: {
                id: "def_1",
                requirementId: "req_1",
                title: "SBA Form",
                status: "PUBLISHED",
              },
            };
          },
        },
        applicationDocumentRequirement: {
          update: async ({ data }) => {
            calls.push(["updateRequirement", data]);
            return { id: "req_1", ...data };
          },
        },
      }),
  };

  try {
    const result = await autoPublishAcroFormIfPresent(prisma, {
      requirement: {
        id: "req_1",
        templateFileUrl: stored.publicUrl,
        templateMimeType: "application/pdf",
        templateFileName: "fillable.pdf",
        signMode: "SIGNATURE_ONLY",
        documentType: { name: "SBA Form" },
      },
      organizationId: "org_1",
      userId: "user_1",
    });

    assert.equal(result.published, true, result.reason || result.error?.message);
    assert.equal(result.signMode, "DYNAMIC_FORM");
    assert.ok(result.fieldCount >= 2);
    assert.ok(
      calls.some(
        ([name, data]) =>
          name === "updateRequirement" && data.signMode === "DYNAMIC_FORM",
      ),
      "expected requirement signMode DYNAMIC_FORM",
    );
  } finally {
    stored.cleanup();
  }
});
