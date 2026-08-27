const fs = require("fs");
const path = require("path");
const {
  resolveDiskPathFromPublicUrl,
  buildPageManifestFromTemplate,
} = require("./pageManifest");
const { detectAcroFormFields } = require("./detectAcroForm");
const { detectAzureLayoutFields, getAzureConfig } = require("./detectAzureLayout");
const { detectFreeOcrFields, getFreeOcrCapabilities } = require("./detectFreeOcr");
const { refineFieldsWithLlm, getLlmConfig } = require("./refineWithLlm");
const { isFreeOcrEnabled } = require("./ocrHeuristics");
const {
  ensureDraftFormForRequirement,
  saveDraftForm,
  getFormForRequirement,
} = require("./formService");

function rectArea(rect) {
  return Math.max(0, rect?.width || 0) * Math.max(0, rect?.height || 0);
}

function intersectionArea(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

function iou(a, b) {
  const inter = intersectionArea(a, b);
  if (inter <= 0) return 0;
  const union = rectArea(a) + rectArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

function confidenceOf(field) {
  const value = Number(field?.meta?.confidence);
  return Number.isFinite(value) ? value : 0.5;
}

/**
 * Merge detected field lists. Higher confidence wins on overlap (same page).
 */
function mergeDetectedFields(fieldLists, { iouThreshold = 0.45 } = {}) {
  const merged = [];

  for (const list of fieldLists) {
    for (const field of list || []) {
      if (!field?.rect || !field.page) continue;
      const overlapIndex = merged.findIndex(
        (existing) =>
          existing.page === field.page &&
          iou(existing.rect, field.rect) >= iouThreshold,
      );

      if (overlapIndex === -1) {
        merged.push(field);
        continue;
      }

      if (confidenceOf(field) > confidenceOf(merged[overlapIndex])) {
        merged[overlapIndex] = {
          ...field,
          meta: {
            ...(field.meta || {}),
            replacedSource: merged[overlapIndex].meta?.source || null,
          },
        };
      }
    }
  }

  const used = new Set();
  return merged.map((field, index) => {
    let key = String(field.key || `field_${index + 1}`);
    if (!/^[a-zA-Z]/.test(key)) {
      key = `f_${key}`;
    }
    key = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
    let suffix = 2;
    const base = key;
    while (used.has(key)) {
      key = `${base}_${suffix}`.slice(0, 64);
      suffix += 1;
    }
    used.add(key);
    return { ...field, key };
  });
}

function buildDetectionReport(parts) {
  return {
    ranAt: new Date().toISOString(),
    providers: parts.map((part) => ({
      provider: part.provider,
      skipped: Boolean(part.skipped),
      note: part.note || null,
      fieldCount: Array.isArray(part.fields) ? part.fields.length : 0,
      error: part.error || null,
    })),
    capabilities: {
      azureConfigured: Boolean(getAzureConfig()),
      llmConfigured: Boolean(getLlmConfig()),
      ...getFreeOcrCapabilities(),
    },
  };
}

function getDetectionCapabilities() {
  return {
    acroform: true,
    azureConfigured: Boolean(getAzureConfig()),
    llmConfigured: Boolean(getLlmConfig()),
    ...getFreeOcrCapabilities(),
  };
}

/**
 * Run detection pipeline for a template file.
 */
async function runFieldDetectionPipeline({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  documentName,
  options = {},
}) {
  const {
    useAzure = true,
    useLlm = true,
    useFreeOcr = isFreeOcrEnabled(),
    replaceExisting = false,
  } = options;

  const templatePath = resolveDiskPathFromPublicUrl(templateFileUrl);
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found on server");
  }

  const mime = String(templateMimeType || "").toLowerCase();
  const ext = path.extname(templateFileName || templatePath || "").toLowerCase();
  const isPdf = mime === "application/pdf" || ext === ".pdf";

  const pages = await buildPageManifestFromTemplate({
    templateFileUrl,
    templateMimeType,
    templateFileName,
  });

  const parts = [];
  let acroFields = [];
  let azureFields = [];
  let freeFields = [];

  if (isPdf) {
    try {
      const pdfBytes = fs.readFileSync(templatePath);
      const acro = await detectAcroFormFields(pdfBytes);
      parts.push(acro);
      acroFields = acro.fields || [];
    } catch (error) {
      parts.push({
        provider: "acroform",
        fields: [],
        error: error.message,
        note: "AcroForm detection failed",
      });
    }
  } else {
    parts.push({
      provider: "acroform",
      fields: [],
      skipped: true,
      note: "AcroForm only applies to PDF templates",
    });
  }

  if (useAzure) {
    try {
      const azure = await detectAzureLayoutFields({
        filePath: templatePath,
        mimeType: isPdf ? "application/pdf" : mime || "application/octet-stream",
        pageManifest: pages,
      });
      parts.push(azure);
      azureFields = azure.fields || [];
    } catch (error) {
      parts.push({
        provider: "azure_layout",
        fields: [],
        error: error.message,
        note: "Azure layout detection failed",
      });
    }
  } else {
    parts.push({
      provider: "azure_layout",
      fields: [],
      skipped: true,
      note: "Azure detection disabled for this request",
    });
  }

  const azureUseful = azureFields.length > 0;
  if (useFreeOcr && !azureUseful) {
    try {
      const free = await detectFreeOcrFields({
        filePath: templatePath,
        mimeType: mime,
        pageManifest: pages,
        isPdf,
      });
      parts.push(free);
      freeFields = free.fields || [];
    } catch (error) {
      parts.push({
        provider: "free_ocr",
        fields: [],
        error: error.message,
        note: "Free OCR detection failed",
      });
    }
  } else {
    parts.push({
      provider: "free_ocr",
      fields: [],
      skipped: true,
      note: azureUseful
        ? "Free OCR skipped because Azure returned fields"
        : "Free OCR disabled for this request",
    });
  }

  let merged = mergeDetectedFields([acroFields, azureFields, freeFields]);

  if (useLlm && merged.length) {
    try {
      const llm = await refineFieldsWithLlm({
        fields: merged,
        documentName,
      });
      parts.push(llm);
      if (!llm.skipped) {
        merged = llm.fields || merged;
      }
    } catch (error) {
      parts.push({
        provider: "llm",
        fields: merged,
        error: error.message,
        note: "LLM refine failed; keeping geometry detections",
      });
    }
  } else {
    parts.push({
      provider: "llm",
      fields: merged,
      skipped: true,
      note: merged.length
        ? "LLM refine skipped"
        : "No fields available for LLM refine",
    });
  }

  const report = buildDetectionReport(parts);

  return {
    pages,
    fields: merged,
    detection: {
      ...report,
      replaceExisting: Boolean(replaceExisting),
      fieldCount: merged.length,
    },
    parts,
  };
}

/**
 * Analyze requirement template and save detected fields into draft form.
 */
async function analyzeAndSaveDraftForm(fastify, {
  requirement,
  organizationId,
  actorUserId,
  options = {},
}) {
  const prisma = fastify.prisma;
  const replaceExisting = Boolean(options.replaceExisting);

  await prisma.applicationDocumentRequirement.update({
    where: { id: requirement.id },
    data: { formProcessingStatus: "PENDING" },
  });

  try {
    await ensureDraftFormForRequirement(prisma, {
      requirement,
      organizationId,
      title:
        requirement.signDocumentTitle ||
        requirement.documentType?.name ||
        "Sign Form",
    });

    const current = await getFormForRequirement(prisma, requirement.id);
    const existingSchema = current?.schema || {};
    const existingFields = Array.isArray(existingSchema.fields)
      ? existingSchema.fields
      : [];

    const pipeline = await runFieldDetectionPipeline({
      templateFileUrl: requirement.templateFileUrl,
      templateMimeType: requirement.templateMimeType,
      templateFileName: requirement.templateFileName,
      documentName:
        requirement.documentType?.name ||
        requirement.customDocumentName ||
        requirement.signDocumentTitle ||
        "Sign document",
      options,
    });

    let nextFields = pipeline.fields;
    if (!replaceExisting && existingFields.length) {
      nextFields = mergeDetectedFields([existingFields, pipeline.fields]);
    }

    const schema = {
      schemaVersion: 1,
      pages: pipeline.pages.length
        ? pipeline.pages
        : existingSchema.pages || [],
      fields: nextFields,
      conditionals: Array.isArray(existingSchema.conditionals)
        ? existingSchema.conditionals
        : [],
      tables: Array.isArray(existingSchema.tables)
        ? existingSchema.tables
        : [],
      detection: pipeline.detection,
    };

    const form = await saveDraftForm(prisma, {
      requirement,
      organizationId,
      schema,
      pageManifest: schema.pages,
    });

    const status = nextFields.length ? "READY" : "FAILED";
    await prisma.applicationDocumentRequirement.update({
      where: { id: requirement.id },
      data: { formProcessingStatus: status },
    });

    return {
      form: {
        ...form,
        formProcessingStatus: status,
      },
      detection: pipeline.detection,
      fieldCount: nextFields.length,
      formProcessingStatus: status,
    };
  } catch (error) {
    await prisma.applicationDocumentRequirement
      .update({
        where: { id: requirement.id },
        data: { formProcessingStatus: "FAILED" },
      })
      .catch(() => {});
    throw error;
  }
}

module.exports = {
  iou,
  mergeDetectedFields,
  runFieldDetectionPipeline,
  analyzeAndSaveDraftForm,
  buildDetectionReport,
  getDetectionCapabilities,
};
