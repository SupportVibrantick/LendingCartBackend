const crypto = require("crypto");
const path = require("path");
const { signFormSchemaJsonSchema } = require("../../../schemas/documents/signForm.schema");
const { assertSignFormLimits } = require("./limits");
const { copySignAsset } = require("./storage");
const { getFormForRequirement } = require("./formService");
const { logAudit } = require("../../logger/auditLogger");

function cloneSchema(schema) {
  const parsed = signFormSchemaJsonSchema.parse(schema);
  assertSignFormLimits(parsed);
  return JSON.parse(JSON.stringify(parsed));
}

function formatLibraryTemplate(row) {
  const schema = row.schemaJson || {};
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    templateFileName: row.templateFileName,
    templateFileUrl: row.templateFileUrl,
    templateMimeType: row.templateMimeType,
    pageCount: Array.isArray(schema.pages) ? schema.pages.length : 0,
    fieldCount: Array.isArray(schema.fields) ? schema.fields.length : 0,
    sourceRequirementId: row.sourceRequirementId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listLibraryTemplates(prisma, organizationId, { includeArchived = false } = {}) {
  const rows = await prisma.signFormLibraryTemplate.findMany({
    where: {
      organizationId,
      ...(includeArchived ? {} : { status: "PUBLISHED" }),
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(formatLibraryTemplate);
}

async function getLibraryTemplate(prisma, organizationId, templateId) {
  const row = await prisma.signFormLibraryTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!row) return null;
  return {
    ...formatLibraryTemplate(row),
    schema: row.schemaJson,
    pageManifest: row.pageManifestJson,
  };
}

async function saveRequirementAsLibraryTemplate(prisma, {
  requirement,
  organizationId,
  userId,
  name,
  description,
  req,
}) {
  const form = await getFormForRequirement(prisma, requirement.id, {
    preferPublished: true,
  });
  if (!form?.schema?.fields?.length) {
    const err = new Error("Publish at least one field before saving a template");
    err.statusCode = 400;
    throw err;
  }

  const schema = cloneSchema(form.schema);
  const ext =
    path.extname(requirement.templateFileName || requirement.templateFileUrl || "") ||
    (String(requirement.templateMimeType || "").includes("pdf") ? ".pdf" : ".bin");
  const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const copied = await copySignAsset({
    fromPublicUrl: requirement.templateFileUrl,
    relativeParts: ["sign-form-library", organizationId],
    filename,
  });

  const created = await prisma.signFormLibraryTemplate.create({
    data: {
      organizationId,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      status: "PUBLISHED",
      templateFileName: requirement.templateFileName || name,
      templateFileUrl: copied.publicUrl,
      templateMimeType: requirement.templateMimeType,
      schemaJson: schema,
      pageManifestJson: form.pageManifest || schema.pages,
      sourceRequirementId: requirement.id,
      createdByUserId: userId || null,
    },
  });

  if (req) {
    await logAudit({
      prisma,
      req,
      dashboard: "LENDER",
      category: "APPLICATION",
      entityType: "SignFormLibraryTemplate",
      entityId: created.id,
      action: "TEMPLATE_SAVED",
      newValue: { name: created.name, requirementId: requirement.id },
    });
  }

  return formatLibraryTemplate(created);
}

async function updateLibraryTemplate(prisma, {
  organizationId,
  templateId,
  patch,
  req,
}) {
  const existing = await prisma.signFormLibraryTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!existing) {
    const err = new Error("Template not found");
    err.statusCode = 404;
    throw err;
  }

  const updated = await prisma.signFormLibraryTemplate.update({
    where: { id: templateId },
    data: {
      ...(patch.name != null ? { name: String(patch.name).trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description ? String(patch.description).trim() : null }
        : {}),
      ...(patch.status ? { status: patch.status } : {}),
    },
  });

  if (req) {
    await logAudit({
      prisma,
      req,
      dashboard: "LENDER",
      category: "APPLICATION",
      entityType: "SignFormLibraryTemplate",
      entityId: updated.id,
      action: patch.status === "ARCHIVED" ? "TEMPLATE_ARCHIVED" : "TEMPLATE_UPDATED",
      oldValue: { name: existing.name, status: existing.status },
      newValue: { name: updated.name, status: updated.status },
    });
  }

  return formatLibraryTemplate(updated);
}

async function applyLibraryTemplate(prisma, {
  template,
  applicationLender,
  organizationId,
  userId,
  documentName,
  req,
}) {
  if (template.status === "ARCHIVED") {
    const err = new Error("This template is archived");
    err.statusCode = 400;
    throw err;
  }

  const schema = cloneSchema(template.schemaJson);
  const title = (documentName || template.name || "Sign document").trim();
  const ext =
    path.extname(template.templateFileName || template.templateFileUrl || "") ||
    (String(template.templateMimeType || "").includes("pdf") ? ".pdf" : ".bin");
  const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const copied = await copySignAsset({
    fromPublicUrl: template.templateFileUrl,
    relativeParts: [
      "loan-documents",
      applicationLender.loanApplicationId,
      "sign-templates",
    ],
    filename,
  });

  const result = await prisma.$transaction(async (tx) => {
    let documentType = await tx.documentType.findFirst({
      where: {
        name: title,
        createdByOrgId: organizationId,
      },
    });

    if (!documentType) {
      documentType = await tx.documentType.create({
        data: {
          name: title,
          code: `SIGN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          isCustom: true,
          createdByOrgId: organizationId,
          isActive: true,
        },
      });
    }

    const requirement = await tx.applicationDocumentRequirement.create({
      data: {
        loanApplicationId: applicationLender.loanApplicationId,
        documentTypeId: documentType.id,
        source: "LENDER_ADDED",
        isRequired: true,
        status: "PENDING",
        lastRequestedAt: new Date(),
        requiresClientSignature: true,
        templateFileName: template.templateFileName || title,
        templateFileUrl: copied.publicUrl,
        templateMimeType: template.templateMimeType,
        signStatus: "AWAITING_BROKER",
        signMode: "DYNAMIC_FORM",
        formProcessingStatus: "READY",
        requestApplicationLenderId: applicationLender.id,
        signDocumentTitle: title,
      },
    });

    await tx.lenderDocumentRequest.upsert({
      where: {
        applicationLenderId_documentTypeId: {
          applicationLenderId: applicationLender.id,
          documentTypeId: documentType.id,
        },
      },
      update: {
        status: "PENDING",
        updatedAt: new Date(),
      },
      create: {
        loanApplicationId: applicationLender.loanApplicationId,
        applicationLenderId: applicationLender.id,
        documentTypeId: documentType.id,
        status: "PENDING",
      },
    });

    const definition = await tx.signFormDefinition.create({
      data: {
        organizationId,
        requirementId: requirement.id,
        title,
        status: "PUBLISHED",
      },
    });

    const version = await tx.signFormVersion.create({
      data: {
        formDefinitionId: definition.id,
        version: 1,
        status: "PUBLISHED",
        schemaJson: schema,
        pageManifestJson: template.pageManifestJson || schema.pages,
        publishedAt: new Date(),
        publishedByUserId: userId || null,
      },
    });

    const updatedRequirement = await tx.applicationDocumentRequirement.update({
      where: { id: requirement.id },
      data: { activeFormVersionId: version.id },
      include: {
        documentType: true,
        uploads: true,
        requestApplicationLender: {
          include: { lender: { select: { name: true } } },
        },
        activeFormVersion: true,
      },
    });

    return updatedRequirement;
  });

  if (req) {
    await logAudit({
      prisma,
      req,
      dashboard: "LENDER",
      category: "APPLICATION",
      entityType: "ApplicationDocumentRequirement",
      entityId: result.id,
      action: "TEMPLATE_APPLIED",
      newValue: {
        templateId: template.id,
        templateName: template.name,
      },
    });
  }

  return result;
}

module.exports = {
  formatLibraryTemplate,
  listLibraryTemplates,
  getLibraryTemplate,
  saveRequirementAsLibraryTemplate,
  updateLibraryTemplate,
  applyLibraryTemplate,
  cloneSchema,
};
