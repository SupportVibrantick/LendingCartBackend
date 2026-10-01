const fs = require("fs");
const path = require("path");
const {
  createFlattenedFormDocument,
  flattenFieldsOntoPdf,
  valueMapFromSubmission,
} = require("./flattenForm");
const {
  loadBytesFromPublicUrl,
} = require("./pageManifest");
const {
  valuesMapFromSubmission,
} = require("./submissionService");
const { getBufferFromRef } = require("../../storage");

function unwrapValuesMap(rawValues) {
  const source = valueMapFromSubmission(rawValues) || {};
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    if (raw && typeof raw === "object" && "value" in raw) {
      out[key] = raw.value;
    } else {
      out[key] = raw;
    }
  }
  return out;
}

function hasAnyFilledValue(values) {
  return Object.values(values || {}).some((value) => {
    if (value == null || value === "") return false;
    if (value === false) return false;
    return true;
  });
}

/**
 * Build a downloadable PDF for a sign-document requirement.
 * Prefers regenerating from latest submission values for DYNAMIC_FORM.
 * Falls back to existing signed output, then blank template.
 */
async function buildSignDocumentDownload(prisma, requirementId) {
  const requirement = await prisma.applicationDocumentRequirement.findUnique({
    where: { id: requirementId },
    include: {
      documentType: true,
      activeFormVersion: true,
      uploads: {
        where: { isSignedOutput: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
      signFormSubmissions: {
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: { values: true },
      },
    },
  });

  if (!requirement) {
    const err = new Error("Sign document not found");
    err.statusCode = 404;
    throw err;
  }

  if (!requirement.templateFileUrl) {
    const err = new Error("Template file missing");
    err.statusCode = 400;
    throw err;
  }

  const documentName =
    requirement.signDocumentTitle ||
    requirement.documentType?.name ||
    "document";

  const safeName = String(documentName)
    .replace(/[<>:"/\\|?*\n\r]+/g, "-")
    .trim() || "document";

  // DYNAMIC_FORM with values → flatten latest values onto template
  if (
    requirement.signMode === "DYNAMIC_FORM" &&
    requirement.activeFormVersion?.schemaJson
  ) {
    const submissions = requirement.signFormSubmissions || [];
    const submission =
      submissions
        .slice()
        .sort(
          (a, b) =>
            (b.values?.length || 0) - (a.values?.length || 0) ||
            new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime(),
        )[0] || null;
    const values = submission
      ? unwrapValuesMap(valuesMapFromSubmission(submission))
      : {};

    if (hasAnyFilledValue(values)) {
      const schema = requirement.activeFormVersion.schemaJson;
      const templatePath = resolveDiskPathFromPublicUrl(
        requirement.templateFileUrl,
      );
      if (!fs.existsSync(templatePath)) {
        const err = new Error("Template file not found on server");
        err.statusCode = 404;
        throw err;
      }

      const mime = String(requirement.templateMimeType || "").toLowerCase();
      const ext = path
        .extname(requirement.templateFileName || templatePath || "")
        .toLowerCase();

      let buffer;
      if (mime === "application/pdf" || ext === ".pdf") {
        buffer = await flattenFieldsOntoPdf({
          templatePath,
          schema,
          values,
        });
      } else {
        const outputDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents",
          requirement.loanApplicationId,
          requirement.id,
          "exports",
        );
        const stored = await createFlattenedFormDocument({
          templateFileUrl: requirement.templateFileUrl,
          templateMimeType: requirement.templateMimeType,
          templateFileName: requirement.templateFileName,
          schema,
          values,
          outputDir,
          outputBaseName: `filled-${Date.now()}`,
          prisma,
        });
        try {
          buffer = await fs.promises.readFile(stored.filePath);
        } catch {
          buffer = await getBufferFromRef(
            {
              storageKey: stored.storageKey,
              storageProvider: stored.storageProvider,
              fileUrl: stored.fileUrl,
            },
            prisma,
          );
        }
      }

      return {
        buffer,
        fileName: `${safeName}-filled.pdf`,
        mimeType: "application/pdf",
        source: "flattened",
        fieldValueCount: Object.keys(values).length,
      };
    }
  }

  // Existing signed/flattened output
  const signed = requirement.uploads?.[0];
  if (signed?.fileUrl) {
    try {
      const buffer = await getBufferFromRef(
        {
          storageKey: signed.storageKey || null,
          storageProvider: signed.storageProvider || null,
          fileUrl: signed.fileUrl,
        },
        prisma,
      );
      return {
        buffer,
        fileName: signed.fileName || `${safeName}-signed.pdf`,
        mimeType: signed.fileMimeType || "application/pdf",
        source: "signed_upload",
      };
    } catch {
      // fall through
    }
  }

  // Blank template fallback
  try {
    const buffer = await loadBytesFromPublicUrl(
      requirement.templateFileUrl,
      prisma,
    );
    return {
      buffer,
      fileName:
        requirement.templateFileName ||
        `${safeName}-template${path.extname(requirement.templateFileUrl || "") || ".pdf"}`,
      mimeType: requirement.templateMimeType || "application/pdf",
      source: "template",
    };
  } catch {
    const err = new Error("Template file not found on server");
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  buildSignDocumentDownload,
  unwrapValuesMap,
  hasAnyFilledValue,
};
