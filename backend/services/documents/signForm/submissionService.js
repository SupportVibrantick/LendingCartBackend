const path = require("path");
const crypto = require("crypto");
const {
  createFlattenedFormDocument,
} = require("./flattenForm");
const {
  evaluateConditionals,
  isFieldVisible,
  isFieldRequiredNow,
} = require("./conditionals");

function unwrapValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return raw.value;
  }
  return raw;
}

function isFieldFilled(field, raw) {
  const value = unwrapValue(raw);
  if (field.type === "checkbox") {
    return value === true || value === false;
  }
  return value != null && value !== "";
}

function isRequiredFieldFilled(field, raw) {
  const value = unwrapValue(raw);
  if (field.type === "checkbox") {
    return value === true;
  }
  return value != null && value !== "";
}

function normalizeFillRole(fillRole) {
  return fillRole || "either";
}

/**
 * Collaborative fill: client and broker can edit any non-readonly field.
 * fillRole still documents intent / defaults, but does not lock fields to one side
 * (except readonly).
 */
function fieldEditableByRole(field, role) {
  const fillRole = normalizeFillRole(field.fillRole);
  if (fillRole === "readonly") return false;
  return role === "client" || role === "broker";
}

function fieldOwnedByRole(field, role) {
  const fillRole = normalizeFillRole(field.fillRole);
  if (fillRole === "readonly") return false;
  return role === "client" || role === "broker";
}

function valuesMapFromSubmission(submission) {
  const values = {};
  for (const item of submission?.values || []) {
    values[item.fieldKey] = item.valueJson;
  }
  return values;
}

function computeProgress(schema, values) {
  const fields = schema?.fields || [];
  const evaluation = evaluateConditionals(schema, values);
  const buckets = {
    client: { required: 0, filled: 0, total: 0 },
    broker: { required: 0, filled: 0, total: 0 },
    all: { required: 0, filled: 0, total: 0 },
  };

  for (const field of fields) {
    const fillRole = normalizeFillRole(field.fillRole);
    if (fillRole === "readonly") continue;
    if (!isFieldVisible(field, evaluation)) continue;

    const filled = isFieldFilled(field, values[field.key]);
    const required = isFieldRequiredNow(field, evaluation);

    buckets.all.total += 1;
    if (required) buckets.all.required += 1;
    if (filled) buckets.all.filled += 1;

    // Shared pool: both roles track the same fillable fields.
    buckets.client.total += 1;
    buckets.broker.total += 1;
    if (required) {
      buckets.client.required += 1;
      buckets.broker.required += 1;
    }
    if (filled) {
      buckets.client.filled += 1;
      buckets.broker.filled += 1;
    }
  }

  const roleRequiredComplete = (role) => {
    for (const field of fields) {
      const fillRole = normalizeFillRole(field.fillRole);
      if (fillRole === "readonly") continue;
      if (!isFieldVisible(field, evaluation)) continue;
      if (!isFieldRequiredNow(field, evaluation)) continue;
      if (role !== "all" && role !== "client" && role !== "broker") {
        continue;
      }
      if (!isRequiredFieldFilled(field, values[field.key])) {
        return false;
      }
    }
    return true;
  };

  return {
    client: {
      ...buckets.client,
      complete: roleRequiredComplete("client"),
    },
    broker: {
      ...buckets.broker,
      complete: roleRequiredComplete("broker"),
    },
    all: {
      ...buckets.all,
      complete: roleRequiredComplete("all"),
    },
  };
}

function missingRequiredFields(schema, values, role) {
  const evaluation = evaluateConditionals(schema, values);
  const missing = [];
  for (const field of schema?.fields || []) {
    if (!isFieldVisible(field, evaluation)) continue;
    if (!isFieldRequiredNow(field, evaluation)) continue;
    if (!fieldOwnedByRole(field, role) && role !== "all") continue;
    if (role === "all" && normalizeFillRole(field.fillRole) === "readonly") {
      continue;
    }
    if (role !== "all" && !fieldOwnedByRole(field, role)) continue;
    if (!isRequiredFieldFilled(field, values[field.key])) {
      missing.push(field);
    }
  }
  return missing;
}

async function getOrCreateDraftSubmission(prisma, {
  requirementId,
  formVersionId,
}) {
  let submission = await prisma.signFormSubmission.findFirst({
    where: {
      requirementId,
      formVersionId,
    },
    include: { values: true },
    orderBy: { createdAt: "desc" },
  });

  if (!submission) {
    submission = await prisma.signFormSubmission.create({
      data: {
        requirementId,
        formVersionId,
        status: "DRAFT",
      },
      include: { values: true },
    });
  }

  return submission;
}

async function saveSubmissionValues(prisma, {
  submissionId,
  values,
  role,
  userId = null,
  editableFields,
}) {
  const allowedKeys = new Set((editableFields || []).map((f) => f.key));
  const filledAt = new Date();
  const filledByRole = role === "broker" ? "BROKER" : "CLIENT";

  for (const [fieldKey, valueJson] of Object.entries(values || {})) {
    if (!allowedKeys.has(fieldKey)) continue;

    const existing = await prisma.signFormSubmissionValue.findFirst({
      where: { submissionId, fieldKey },
    });

    if (existing) {
      await prisma.signFormSubmissionValue.update({
        where: { id: existing.id },
        data: {
          valueJson,
          filledByRole,
          filledByUserId: role === "broker" ? userId : null,
          filledAt,
        },
      });
    } else {
      await prisma.signFormSubmissionValue.create({
        data: {
          submissionId,
          fieldKey,
          valueJson,
          filledByRole,
          filledByUserId: role === "broker" ? userId : null,
          filledAt,
        },
      });
    }
  }

  return prisma.signFormSubmission.findUnique({
    where: { id: submissionId },
    include: { values: true },
  });
}

async function finalizeFormIfComplete(prisma, {
  requirement,
  schema,
  submission,
  clientUserId = null,
  notify,
}) {
  const values = valuesMapFromSubmission(submission);
  const progress = computeProgress(schema, values);

  if (!progress.all.complete) {
    return {
      finalized: false,
      progress,
      submission,
      requirement,
      signedUpload: null,
    };
  }

  if (requirement.signStatus === "CLIENT_SIGNED" ||
      requirement.signStatus === "FORWARDED_TO_LENDER" ||
      requirement.signStatus === "LENDER_SEEN") {
    return {
      finalized: true,
      progress,
      submission,
      requirement,
      signedUpload: null,
      alreadyFinal: true,
    };
  }

  const outputDir = path.join(
    process.cwd(),
    "uploads",
    "loan-documents",
    requirement.loanApplicationId,
    requirement.id,
  );

  const signedAt = new Date();
  const signedFile = await createFlattenedFormDocument({
    templateFileUrl: requirement.templateFileUrl,
    templateMimeType: requirement.templateMimeType,
    templateFileName: requirement.templateFileName,
    schema,
    values,
    outputDir,
    outputBaseName: `signed-form-${crypto.randomBytes(8).toString("hex")}`,
  });

  const signatureField = (schema?.fields || []).find(
    (field) => field.type === "signature",
  );
  const signatureRaw = signatureField ? values[signatureField.key] : null;
  const signatureData =
    typeof signatureRaw === "string"
      ? signatureRaw
      : signatureRaw?.value || null;

  const result = await prisma.$transaction(async (tx) => {
    const completedSubmission = await tx.signFormSubmission.update({
      where: { id: submission.id },
      data: {
        status: "COMPLETE",
        submittedAt: signedAt,
        submittedByClientUserId: clientUserId || undefined,
      },
      include: { values: true },
    });

    const signedUpload = await tx.applicationDocumentUpload.create({
      data: {
        loanApplicationId: requirement.loanApplicationId,
        documentRequirementId: requirement.id,
        uploadedByClientUserId: clientUserId || null,
        fileName: signedFile.fileName,
        fileUrl: signedFile.fileUrl,
        fileMimeType: signedFile.fileMimeType,
        isSignedOutput: true,
        clientSignatureData:
          typeof signatureData === "string" ? signatureData : null,
        isSubmittedToLender: false,
      },
    });

    const updatedRequirement = await tx.applicationDocumentRequirement.update({
      where: { id: requirement.id },
      data: {
        signStatus: "CLIENT_SIGNED",
        clientSignedAt: signedAt,
        status: "COMPLETE",
      },
      include: {
        documentType: true,
        uploads: {
          where: { isSignedOutput: true },
          orderBy: { uploadedAt: "desc" },
        },
        requestApplicationLender: {
          include: { lender: { select: { name: true } } },
        },
        activeFormVersion: true,
      },
    });

    return {
      submission: completedSubmission,
      signedUpload,
      requirement: updatedRequirement,
    };
  });

  if (typeof notify === "function") {
    await notify(result);
  }

  return {
    finalized: true,
    progress: computeProgress(schema, valuesMapFromSubmission(result.submission)),
    submission: result.submission,
    requirement: result.requirement,
    signedUpload: result.signedUpload,
  };
}

function annotateFieldsForRole(fields, role, values, schema = null) {
  const evaluation = evaluateConditionals(
    schema || { fields, conditionals: [] },
    values,
  );
  return (fields || []).map((field) => {
    const editable = fieldEditableByRole(field, role);
    const visible = isFieldVisible(field, evaluation);
    return {
      ...field,
      editable,
      readOnly: !editable,
      visible,
      required: isFieldRequiredNow(field, evaluation),
      currentValue: values?.[field.key] ?? null,
    };
  });
}

module.exports = {
  unwrapValue,
  isFieldFilled,
  isRequiredFieldFilled,
  normalizeFillRole,
  fieldEditableByRole,
  fieldOwnedByRole,
  valuesMapFromSubmission,
  computeProgress,
  missingRequiredFields,
  getOrCreateDraftSubmission,
  saveSubmissionValues,
  finalizeFormIfComplete,
  annotateFieldsForRole,
};
