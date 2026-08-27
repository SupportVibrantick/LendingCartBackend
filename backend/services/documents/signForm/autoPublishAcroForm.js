const fs = require("fs");
const {
  detectAcroFormFields,
} = require("./detectAcroForm");
const {
  buildPageManifestFromTemplate,
  resolveDiskPathFromPublicUrl,
} = require("./pageManifest");
const { publishForm } = require("./formService");

function isPdfTemplate({ templateMimeType, templateFileName }) {
  const mime = String(templateMimeType || "").toLowerCase();
  const name = String(templateFileName || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function normalizeDetectedFields(fields) {
  return (fields || []).map((field) => ({
    ...field,
    required: Boolean(field.required),
    fillRole: field.fillRole || "either",
  }));
}

/**
 * Detect AcroForm fields on a template PDF and build a publishable schema.
 * Does not write to the database.
 *
 * @returns {{ ok: true, schema, pageManifest, fieldCount, detection } | { ok: false, reason: string }}
 */
async function prepareAcroFormAutoPublish({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  pdfBytes: pdfBytesOverride = null,
} = {}) {
  if (!isPdfTemplate({ templateMimeType, templateFileName })) {
    return { ok: false, reason: "not_pdf" };
  }

  let pdfBytes = pdfBytesOverride;
  if (!pdfBytes) {
    if (!templateFileUrl) {
      return { ok: false, reason: "missing_template" };
    }
    const diskPath = resolveDiskPathFromPublicUrl(templateFileUrl);
    if (!fs.existsSync(diskPath)) {
      return { ok: false, reason: "template_missing" };
    }
    pdfBytes = fs.readFileSync(diskPath);
  }

  const detected = await detectAcroFormFields(pdfBytes);
  const fields = normalizeDetectedFields(detected.fields);
  if (!fields.length) {
    return {
      ok: false,
      reason: "no_fields",
      detection: {
        providers: [
          {
            provider: detected.provider,
            note: detected.note,
            fieldCount: 0,
          },
        ],
      },
    };
  }

  const pages = await buildPageManifestFromTemplate({
    templateFileUrl,
    templateMimeType,
    templateFileName,
  }).catch(async () => {
    // When tests pass pdfBytes without a disk file, derive pages from bytes.
    const { PDFDocument } = require("pdf-lib");
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return pdfDoc.getPages().map((page, index) => {
      const { width, height } = page.getSize();
      return {
        page: index + 1,
        widthPt: width,
        heightPt: height,
        imageUrl: null,
        rotation: 0,
      };
    });
  });

  const detection = {
    providers: [
      {
        provider: detected.provider,
        note: detected.note,
        fieldCount: fields.length,
      },
    ],
    autoPublished: true,
  };

  const schema = {
    schemaVersion: 1,
    pages,
    fields,
    conditionals: [],
    tables: [],
    detection,
  };

  return {
    ok: true,
    schema,
    pageManifest: pages,
    fieldCount: fields.length,
    detection,
  };
}

/**
 * If the requirement template is a fillable PDF, detect AcroForm fields and
 * publish as DYNAMIC_FORM. On no fields / errors, leave SIGNATURE_ONLY.
 */
async function autoPublishAcroFormIfPresent(prisma, {
  requirement,
  organizationId,
  userId = null,
  logger = null,
  pdfBytes = null,
} = {}) {
  const baseResult = {
    published: false,
    signMode: requirement?.signMode || "SIGNATURE_ONLY",
    fieldCount: 0,
    reason: null,
  };

  if (!requirement?.id || !organizationId) {
    return { ...baseResult, reason: "invalid_args" };
  }

  let prepared;
  try {
    prepared = await prepareAcroFormAutoPublish({
      templateFileUrl: requirement.templateFileUrl,
      templateMimeType: requirement.templateMimeType,
      templateFileName: requirement.templateFileName,
      pdfBytes,
    });
  } catch (error) {
    logger?.error?.(
      { err: error, requirementId: requirement.id },
      "AcroForm auto-publish prepare failed",
    );
    return { ...baseResult, reason: "prepare_failed", error };
  }

  if (!prepared.ok) {
    return { ...baseResult, reason: prepared.reason };
  }

  try {
    const form = await publishForm(prisma, {
      requirement,
      organizationId,
      userId,
      schema: prepared.schema,
      pageManifest: prepared.pageManifest,
    });

    return {
      published: true,
      signMode: "DYNAMIC_FORM",
      fieldCount: prepared.fieldCount,
      form,
      reason: null,
    };
  } catch (error) {
    logger?.error?.(
      { err: error, requirementId: requirement.id },
      "AcroForm auto-publish failed",
    );
    return {
      ...baseResult,
      reason: "publish_failed",
      error,
    };
  }
}

module.exports = {
  isPdfTemplate,
  prepareAcroFormAutoPublish,
  autoPublishAcroFormIfPresent,
};
