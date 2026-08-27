const {
  signFormSchemaJsonSchema,
} = require("../../../schemas/documents/signForm.schema");
const {
  buildPageManifestFromTemplate,
  emptySchemaForPages,
} = require("./pageManifest");
const { assertSignFormLimits } = require("./limits");

function formatFormPayload(definition, version, requirement) {
  const schema = version?.schemaJson || emptySchemaForPages([]);
  const pageManifest =
    version?.pageManifestJson || schema.pages || [];

  return {
    definitionId: definition.id,
    requirementId: definition.requirementId,
    title: definition.title,
    definitionStatus: definition.status,
    versionId: version?.id || null,
    version: version?.version || null,
    versionStatus: version?.status || null,
    publishedAt: version?.publishedAt || null,
    schema,
    pageManifest,
    signMode: requirement?.signMode || "SIGNATURE_ONLY",
    formProcessingStatus: requirement?.formProcessingStatus || "NONE",
    activeFormVersionId: requirement?.activeFormVersionId || null,
    templateFileUrl: requirement?.templateFileUrl || null,
    templateMimeType: requirement?.templateMimeType || null,
    templateFileName: requirement?.templateFileName || null,
    signStatus: requirement?.signStatus || null,
  };
}

async function ensureDraftFormForRequirement(prisma, {
  requirement,
  organizationId,
  title,
}) {
  let definition = await prisma.signFormDefinition.findUnique({
    where: { requirementId: requirement.id },
    include: {
      versions: { orderBy: { version: "desc" }, take: 5 },
    },
  });

  if (!definition) {
    const pages = await buildPageManifestFromTemplate({
      templateFileUrl: requirement.templateFileUrl,
      templateMimeType: requirement.templateMimeType,
      templateFileName: requirement.templateFileName,
    });
    const schema = emptySchemaForPages(pages);

    definition = await prisma.$transaction(async (tx) => {
      const created = await tx.signFormDefinition.create({
        data: {
          organizationId,
          requirementId: requirement.id,
          title: title || requirement.signDocumentTitle || requirement.documentType?.name || "Sign Form",
          status: "DRAFT",
        },
      });

      await tx.signFormVersion.create({
        data: {
          formDefinitionId: created.id,
          version: 1,
          status: "DRAFT",
          schemaJson: schema,
          pageManifestJson: pages,
        },
      });

      await tx.applicationDocumentRequirement.update({
        where: { id: requirement.id },
        data: {
          formProcessingStatus: "READY",
        },
      });

      return tx.signFormDefinition.findUnique({
        where: { id: created.id },
        include: {
          versions: { orderBy: { version: "desc" }, take: 5 },
        },
      });
    });
  }

  let draft = definition.versions.find((v) => v.status === "DRAFT");
  if (!draft) {
    const latest = definition.versions[0];
    const nextVersion = (latest?.version || 0) + 1;
    const baseSchema = latest?.schemaJson || emptySchemaForPages([]);
    const pages =
      latest?.pageManifestJson ||
      baseSchema.pages ||
      (await buildPageManifestFromTemplate({
        templateFileUrl: requirement.templateFileUrl,
        templateMimeType: requirement.templateMimeType,
        templateFileName: requirement.templateFileName,
      }));

    draft = await prisma.signFormVersion.create({
      data: {
        formDefinitionId: definition.id,
        version: nextVersion,
        status: "DRAFT",
        schemaJson: {
          ...baseSchema,
          pages,
        },
        pageManifestJson: pages,
      },
    });
  }

  const refreshedRequirement =
    await prisma.applicationDocumentRequirement.findUnique({
      where: { id: requirement.id },
    });

  return formatFormPayload(definition, draft, refreshedRequirement);
}

async function getFormForRequirement(prisma, requirementId, { preferPublished = false } = {}) {
  const requirement = await prisma.applicationDocumentRequirement.findUnique({
    where: { id: requirementId },
    include: {
      documentType: true,
      signFormDefinition: {
        include: {
          versions: { orderBy: { version: "desc" } },
        },
      },
      activeFormVersion: true,
    },
  });

  if (!requirement) {
    return null;
  }

  const definition = requirement.signFormDefinition;
  if (!definition) {
    return {
      definitionId: null,
      requirementId: requirement.id,
      title: requirement.signDocumentTitle || requirement.documentType?.name || "Sign Form",
      definitionStatus: null,
      versionId: null,
      version: null,
      versionStatus: null,
      publishedAt: null,
      schema: null,
      pageManifest: null,
      signMode: requirement.signMode,
      formProcessingStatus: requirement.formProcessingStatus,
      activeFormVersionId: requirement.activeFormVersionId,
      templateFileUrl: requirement.templateFileUrl,
      templateMimeType: requirement.templateMimeType,
      templateFileName: requirement.templateFileName,
      signStatus: requirement.signStatus,
    };
  }

  let version = null;
  if (preferPublished && requirement.activeFormVersion) {
    version = requirement.activeFormVersion;
  } else {
    version =
      definition.versions.find((v) => v.status === "DRAFT") ||
      requirement.activeFormVersion ||
      definition.versions[0] ||
      null;
  }

  if (preferPublished && !version) {
    version = definition.versions.find((v) => v.status === "PUBLISHED") || null;
  }

  return formatFormPayload(definition, version, requirement);
}

async function saveDraftForm(prisma, {
  requirement,
  organizationId,
  schema,
  pageManifest,
  title,
}) {
  const parsed = signFormSchemaJsonSchema.parse(schema);
  assertSignFormLimits(parsed);
  const keys = parsed.fields.map((field) => field.key);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate) {
    const err = new Error(`Duplicate field key: ${duplicate}`);
    err.statusCode = 400;
    throw err;
  }
  const pages = pageManifest || parsed.pages;

  const payload = await ensureDraftFormForRequirement(prisma, {
    requirement,
    organizationId,
    title,
  });

  const updated = await prisma.signFormVersion.update({
    where: { id: payload.versionId },
    data: {
      schemaJson: {
        ...parsed,
        pages,
      },
      pageManifestJson: pages,
    },
    include: {
      formDefinition: true,
    },
  });

  const refreshedRequirement =
    await prisma.applicationDocumentRequirement.findUnique({
      where: { id: requirement.id },
    });

  return formatFormPayload(
    updated.formDefinition,
    updated,
    refreshedRequirement,
  );
}

async function publishForm(prisma, {
  requirement,
  organizationId,
  userId,
  schema,
  pageManifest,
}) {
  let draftPayload;
  if (schema) {
    draftPayload = await saveDraftForm(prisma, {
      requirement,
      organizationId,
      schema,
      pageManifest,
    });
  } else {
    draftPayload = await ensureDraftFormForRequirement(prisma, {
      requirement,
      organizationId,
    });
  }

  if (!draftPayload.schema?.fields?.length) {
    const err = new Error("Add at least one field before publishing");
    err.statusCode = 400;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    const published = await tx.signFormVersion.update({
      where: { id: draftPayload.versionId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: userId || null,
      },
      include: { formDefinition: true },
    });

    await tx.signFormDefinition.update({
      where: { id: published.formDefinitionId },
      data: { status: "PUBLISHED" },
    });

    const updatedRequirement = await tx.applicationDocumentRequirement.update({
      where: { id: requirement.id },
      data: {
        signMode: "DYNAMIC_FORM",
        formProcessingStatus: "READY",
        activeFormVersionId: published.id,
      },
    });

    return { published, updatedRequirement };
  });

  return formatFormPayload(
    result.published.formDefinition,
    result.published,
    result.updatedRequirement,
  );
}

module.exports = {
  formatFormPayload,
  ensureDraftFormForRequirement,
  getFormForRequirement,
  saveDraftForm,
  publishForm,
};
