const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const sharp = require("sharp");
const {
  resolveDiskPathFromPublicUrl,
} = require("./pageManifest");
const {
  decodeSignatureDataUrl,
} = require("../signDocumentMerge");
const {
  evaluateConditionals,
  isFieldVisible,
} = require("./conditionals");

function valueMapFromSubmission(values) {
  if (!values) return {};
  if (Array.isArray(values)) {
    return values.reduce((acc, item) => {
      acc[item.fieldKey] = item.valueJson;
      return acc;
    }, {});
  }
  return { ...values };
}

function unwrapValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return raw.value;
  }
  return raw;
}

/** Only explicit checked values — never Boolean("false") / Boolean("No") / etc. */
function isCheckboxChecked(raw) {
  const value = unwrapValue(raw);
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "True" ||
    value === "yes" ||
    value === "Yes" ||
    value === "YES" ||
    value === "on" ||
    value === "On" ||
    value === "checked"
  );
}

function drawCheckboxMark(page, rect, checked) {
  if (!checked || !rect) return;
  const size = Math.min(rect.width, rect.height);
  if (size < 2) return;

  const pad = Math.max(1, size * 0.2);
  const x0 = rect.x + pad;
  const y0 = rect.y + pad;
  const w = Math.max(2, rect.width - pad * 2);
  const h = Math.max(2, rect.height - pad * 2);
  const color = rgb(0.05, 0.05, 0.05);
  const thickness = Math.max(1.2, size * 0.12);

  // Checkmark (two strokes) — not an "X", which looked like every box was crossed.
  page.drawLine({
    start: { x: x0, y: y0 + h * 0.45 },
    end: { x: x0 + w * 0.35, y: y0 },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: x0 + w * 0.35, y: y0 },
    end: { x: x0 + w, y: y0 + h },
    thickness,
    color,
  });
}

async function embedPngDataUrl(pdfDoc, dataUrl) {
  const buffer = decodeSignatureDataUrl(dataUrl);
  return pdfDoc.embedPng(buffer);
}

function acroNameCandidates(field) {
  return [
    field.meta?.detectedLabel,
    field.label,
    field.key,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
}

/**
 * Try to write a value into a native PDF AcroForm widget.
 * Returns true when a matching widget was updated.
 */
function applyValueToAcroForm(form, field, raw) {
  if (field.type === "signature" || field.type === "initial") return false;
  if (field.type === "checkbox") {
    // Checkboxes are drawn as overlays after widgets are stripped. Avoid baking
    // native appearances — SBA forms often flatten with an "X" on every box.
    return false;
  }
  if (raw == null || raw === "") return false;

  for (const name of acroNameCandidates(field)) {
    try {
      if (field.type === "radio") {
        const group = form.getRadioGroup(name);
        group.select(String(raw));
        return true;
      }

      if (field.type === "dropdown") {
        const dropdown = form.getDropdown(name);
        dropdown.select(String(raw));
        return true;
      }

      const textField = form.getTextField(name);
      let text = String(raw);
      if (field.type === "currency" && text && !text.startsWith("$")) {
        text = `$${text}`;
      }
      textField.setText(text.slice(0, 500));
      return true;
    } catch {
      // try next candidate name
    }
  }

  return false;
}

function drawOverlayValue(page, field, raw, font, pdfDoc) {
  const rect = field.rect;
  if (!rect) return Promise.resolve();

  const type = field.type;

  if (type === "checkbox") {
    drawCheckboxMark(page, rect, isCheckboxChecked(raw));
    return Promise.resolve();
  }

  if (type === "radio") {
    const selected = String(unwrapValue(raw) ?? "");
    const options = field.options || [];
    for (const option of options) {
      if (String(option.value) !== selected) continue;
      drawCheckboxMark(page, option.rect || rect, true);
    }
    return Promise.resolve();
  }

  if (type === "signature" || type === "initial") {
    if (typeof raw !== "string" || !raw.startsWith("data:image")) {
      return Promise.resolve();
    }
    return embedPngDataUrl(pdfDoc, raw)
      .then((pngImage) => {
        page.drawImage(pngImage, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      })
      .catch(() => {});
  }

  let text = String(raw);
  if (type === "currency" && text && !text.startsWith("$")) {
    text = `$${text}`;
  }

  const fontSize = Math.max(
    8,
    Math.min(14, Math.floor(rect.height * 0.65)),
  );

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
    opacity: 0.92,
  });

  page.drawText(text.slice(0, 500), {
    x: rect.x + 2,
    y: rect.y + Math.max(2, (rect.height - fontSize) / 2),
    size: fontSize,
    font,
    color: rgb(0.05, 0.05, 0.05),
    maxWidth: Math.max(10, rect.width - 4),
  });

  return Promise.resolve();
}

async function flattenFieldsOntoPdf({
  templatePath,
  schema,
  values,
}) {
  const pdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const valueMap = valueMapFromSubmission(values);
  const evaluation = evaluateConditionals(schema, valueMap);
  const fields = schema?.fields || [];

  let form = null;
  try {
    form = pdfDoc.getForm();
  } catch {
    form = null;
  }

  // 1) Fill native AcroForm text/dropdown widgets when names match, then strip
  //    the form so interactive widgets cannot cover our overlays.
  //    Checkboxes are never baked via AcroForm — SBA widgets use an "X" On
  //    appearance and flatten was putting crosses on every box.
  if (form) {
    try {
      for (const acroField of [...form.getFields()]) {
        const ctor = acroField.constructor?.name || "";
        const isCheckbox =
          ctor.includes("CheckBox") ||
          (typeof acroField.check === "function" &&
            typeof acroField.uncheck === "function" &&
            typeof acroField.isChecked === "function");
        if (!isCheckbox) continue;
        try {
          form.removeField(acroField);
        } catch {
          try {
            acroField.uncheck();
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    for (const field of fields) {
      if (!isFieldVisible(field, evaluation)) continue;
      if (field.type === "checkbox") continue;
      const raw = unwrapValue(valueMap[field.key]);
      if (raw == null || raw === "") continue;
      applyValueToAcroForm(form, field, raw);
    }

    try {
      form.updateFieldAppearances(font);
    } catch {
      // Some PDFs reject appearance updates; flatten/remove may still work.
    }

    try {
      form.flatten();
    } catch {
      // Fall through to removeField below.
    }

    try {
      for (const acroField of [...form.getFields()]) {
        try {
          form.removeField(acroField);
        } catch {
          // ignore per-field removal errors
        }
      }
    } catch {
      // ignore
    }
  }

  // 2) Always paint values on top (white plate + text/check/signature).
  for (const field of fields) {
    if (!isFieldVisible(field, evaluation)) continue;

    const pageIndex = (field.page || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const raw = unwrapValue(valueMap[field.key]);

    if (field.type === "checkbox") {
      if (!isCheckboxChecked(raw)) continue;
    } else if (raw == null || raw === "") {
      continue;
    }

    await drawOverlayValue(page, field, raw, font, pdfDoc);
  }

  return Buffer.from(await pdfDoc.save());
}

async function flattenFieldsOntoImage({
  templatePath,
  mimeType,
  schema,
  values,
}) {
  // Convert image → single-page PDF, flatten, return PDF for consistency.
  const imageBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.create();
  let embedded;
  const mime = String(mimeType || "").toLowerCase();

  if (mime.includes("png")) {
    embedded = await pdfDoc.embedPng(imageBytes);
  } else {
    const jpegBuffer = await sharp(templatePath).jpeg({ quality: 92 }).toBuffer();
    embedded = await pdfDoc.embedJpg(jpegBuffer);
  }

  const page = pdfDoc.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: embedded.width,
    height: embedded.height,
  });

  const tempPdfBytes = await pdfDoc.save();
  const tempPath = path.join(
    path.dirname(templatePath),
    `.tmp-sign-form-${Date.now()}.pdf`,
  );
  await fs.promises.writeFile(tempPath, tempPdfBytes);

  try {
    return await flattenFieldsOntoPdf({
      templatePath: tempPath,
      schema,
      values,
    });
  } finally {
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

async function createFlattenedFormDocument({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  schema,
  values,
  outputDir,
  outputBaseName,
}) {
  const templatePath = resolveDiskPathFromPublicUrl(templateFileUrl);
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found on server");
  }

  const mime = String(templateMimeType || "").toLowerCase();
  const ext = path.extname(templateFileName || templatePath || "").toLowerCase();
  let outputBuffer;

  if (mime === "application/pdf" || ext === ".pdf") {
    outputBuffer = await flattenFieldsOntoPdf({
      templatePath,
      schema,
      values,
    });
  } else if (mime.startsWith("image/")) {
    outputBuffer = await flattenFieldsOntoImage({
      templatePath,
      mimeType: mime,
      schema,
      values,
    });
  } else {
    throw new Error("Unsupported template type. Use PDF or image.");
  }

  await fs.promises.mkdir(outputDir, { recursive: true });
  const safeBase = `${outputBaseName}.pdf`;
  const outputPath = path.join(outputDir, safeBase);
  await fs.promises.writeFile(outputPath, outputBuffer);

  const relativeFromUploads = path
    .relative(path.join(process.cwd(), "uploads"), outputDir)
    .split(path.sep)
    .join("/");

  return {
    fileName: safeBase,
    fileUrl: `/uploads/${relativeFromUploads}/${safeBase}`.replace(/\\/g, "/"),
    fileMimeType: "application/pdf",
    filePath: outputPath,
  };
}

module.exports = {
  createFlattenedFormDocument,
  flattenFieldsOntoPdf,
  valueMapFromSubmission,
  applyValueToAcroForm,
  isCheckboxChecked,
};
