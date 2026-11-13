const { randomUUID } = require("crypto");
const { Prisma } = require("@prisma/client");
const {
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
} = require("./staticSubmissionFields");
const {
  buildLoanApplicationSyncFromFields,
} = require("../../utils/applications/resolveRequestedAmount");

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function stripCurrency(value) {
  if (value == null || value === "") return "";
  return String(value).replace(/[$,]/g, "").trim();
}

function addDisplayField(fields, fieldKey, value) {
  const normalized = asTrimmedString(value);
  if (!normalized) return;
  fields.push({
    fieldKey,
    value: normalized,
    source: "STATIC",
  });
}

function buildDisplayFieldsFromDraft(draft = {}, loanProductCode = "") {
  const formData = draft.formData && typeof draft.formData === "object"
    ? draft.formData
    : {};
  const borrower =
    formData.borrower && typeof formData.borrower === "object"
      ? formData.borrower
      : {};
  const loanRequest =
    formData.loanRequest && typeof formData.loanRequest === "object"
      ? formData.loanRequest
      : {};
  const loanTermIncome =
    formData.loanTermIncome && typeof formData.loanTermIncome === "object"
      ? formData.loanTermIncome
      : {};

  const fields = [];
  const firstName = asTrimmedString(borrower.firstName);
  const lastName = asTrimmedString(borrower.lastName);
  const fullName =
    asTrimmedString(borrower.name) || `${firstName} ${lastName}`.trim();

  addDisplayField(fields, "borrowerFirstName", firstName);
  addDisplayField(fields, "borrowerLastName", lastName);
  addDisplayField(fields, "firstName", firstName);
  addDisplayField(fields, "lastName", lastName);
  addDisplayField(fields, "name", fullName);
  addDisplayField(fields, "email", borrower.email);
  addDisplayField(fields, "phone", borrower.phone);
  addDisplayField(
    fields,
    "amountRequested",
    stripCurrency(loanRequest.amount),
  );
  addDisplayField(fields, "purpose", loanRequest.purpose);
  addDisplayField(fields, "propertyCity", loanRequest.city);
  addDisplayField(fields, "city", loanRequest.city);
  addDisplayField(fields, "propertyState", loanRequest.state);
  addDisplayField(fields, "state", loanRequest.state);
  addDisplayField(fields, "propertyCountry", loanRequest.propertyCountry);
  addDisplayField(fields, "country", loanRequest.propertyCountry);
  addDisplayField(fields, "loanTerm", loanTermIncome.loanTerm);
  addDisplayField(fields, "loanProductCode", loanProductCode);
  addDisplayField(fields, "loanCategory", draft.selectedCategory);
  return fields;
}

function incompleteAccessWhere({ brokerOrgId, userId, actor }) {
  const where = {
    brokerOrgId,
    status: "INCOMPLETE",
  };

  if (actor === "loanOfficer" && userId) {
    where.OR = [
      { brokerUserId: userId },
      { loanOfficerAssignments: { some: { loanOfficerId: userId } } },
    ];
  }

  if (actor === "coBroker" && userId) {
    where.subBrokerAssignments = {
      some: { subBrokerId: userId },
    };
  }

  return where;
}

async function findIncompleteApplication(
  prisma,
  { applicationId, brokerOrgId, userId, actor },
) {
  if (!applicationId) return null;
  return prisma.loanApplication.findFirst({
    where: {
      id: applicationId,
      ...incompleteAccessWhere({ brokerOrgId, userId, actor }),
    },
    include: {
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

async function replaceSubmissionFields(tx, submissionId, fields) {
  await tx.applicationSubmissionField.deleteMany({
    where: { submissionId },
  });

  if (!fields.length) return;

  await tx.applicationSubmissionField.createMany({
    data: fields.map((field) => ({
      submissionId,
      fieldId: field.fieldId || null,
      fieldKey: field.fieldKey || null,
      value: field.value ?? null,
      source: field.source || (field.fieldId ? "DYNAMIC" : "STATIC"),
    })),
  });
}

async function saveIncompleteApplication(prisma, input) {
  const {
    applicationId = null,
    brokerOrgId,
    userId,
    actor = "broker",
    loanProductCode,
    applicationProductId = null,
    draft,
  } = input;

  if (!brokerOrgId) {
    return { error: { status: 401, message: "Unauthorized" } };
  }
  if (!loanProductCode) {
    return { error: { status: 400, message: "loanProductCode is required" } };
  }
  if (!draft || typeof draft !== "object") {
    return { error: { status: 400, message: "draft is required" } };
  }

  const displayFields = buildDisplayFieldsFromDraft(draft, loanProductCode);
  const loanSync = buildLoanApplicationSyncFromFields(displayFields);

  const result = await prisma.$transaction(async (tx) => {
    if (applicationId) {
      const existing = await findIncompleteApplication(tx, {
        applicationId,
        brokerOrgId,
        userId,
        actor,
      });

      if (!existing) {
        throw Object.assign(new Error("Incomplete application not found"), {
          statusCode: 404,
        });
      }

      const submission = existing.submissions[0];
      if (!submission) {
        throw Object.assign(new Error("Incomplete submission not found"), {
          statusCode: 400,
        });
      }

      await tx.loanApplication.update({
        where: { id: existing.id },
        data: {
          loanProductCode,
          incompleteDraft: draft,
          ...loanSync,
        },
      });

      await replaceSubmissionFields(tx, submission.id, displayFields);

      return {
        applicationId: existing.id,
        submissionId: submission.id,
        applicationNumber: existing.applicationNumber,
        created: false,
      };
    }

    const created = await tx.loanApplication.create({
      data: {
        id: randomUUID(),
        applicationNumber: `APP-${Date.now()}`,
        brokerOrgId,
        brokerUserId: actor === "loanOfficer" ? userId : null,
        clientId: null,
        loanProductCode,
        status: "INCOMPLETE",
        incompleteDraft: draft,
        ...loanSync,
        ...(actor === "loanOfficer" && userId
          ? {
              loanOfficerAssignments: {
                create: {
                  loanOfficerId: userId,
                  assignedById: userId,
                },
              },
            }
          : {}),
        ...(actor === "coBroker" && userId
          ? {
              subBrokerAssignments: {
                create: {
                  subBrokerId: userId,
                  assignedById: userId,
                },
              },
            }
          : {}),
      },
    });

    const submission = await tx.applicationSubmission.create({
      data: {
        applicationId: created.id,
        ...(applicationProductId ? { applicationProductId } : {}),
        status: "INCOMPLETE",
      },
    });

    await replaceSubmissionFields(tx, submission.id, displayFields);

    return {
      applicationId: created.id,
      submissionId: submission.id,
      applicationNumber: created.applicationNumber,
      created: true,
    };
  });

  return { data: result };
}

async function getIncompleteApplication(prisma, input) {
  const application = await findIncompleteApplication(prisma, input);
  if (!application) {
    return { error: { status: 404, message: "Incomplete application not found" } };
  }

  return {
    data: {
      applicationId: application.id,
      submissionId: application.submissions[0]?.id || null,
      applicationNumber: application.applicationNumber,
      loanProductCode: application.loanProductCode,
      draft: application.incompleteDraft || null,
    },
  };
}

async function promoteIncompleteApplication(tx, input) {
  const {
    application,
    fields,
    resolvedLoanProductCode,
    resolvedApplicationProductId,
    client,
    sanitizedRequestedDocumentTypes,
    completedStatus = "CLIENT_PENDING",
  } = input;

  const latestSubmission = application.submissions?.[0];
  const fieldIdByKey = await loadProductFieldIdMap(
    tx,
    resolvedApplicationProductId,
  );
  const normalizedFields = buildSubmissionFieldsPayload(fields, fieldIdByKey);

  let submission = latestSubmission;
  if (!submission) {
    submission = await tx.applicationSubmission.create({
      data: {
        applicationId: application.id,
        ...(resolvedApplicationProductId
          ? { applicationProductId: resolvedApplicationProductId }
          : {}),
        status: completedStatus,
      },
    });
  } else {
    await tx.applicationSubmission.update({
      where: { id: submission.id },
      data: {
        status: completedStatus,
        ...(resolvedApplicationProductId
          ? { applicationProductId: resolvedApplicationProductId }
          : {}),
      },
    });
  }

  await replaceSubmissionFields(tx, submission.id, normalizedFields);

  const loanUpdate = {
    status: completedStatus,
    clientId: client.id,
    loanProductCode: resolvedLoanProductCode,
    incompleteDraft: Prisma.DbNull,
    ...buildLoanApplicationSyncFromFields(fields),
  };

  if (sanitizedRequestedDocumentTypes !== undefined) {
    loanUpdate.requestedDocumentTypes = sanitizedRequestedDocumentTypes;
  }

  const loanApplication = await tx.loanApplication.update({
    where: { id: application.id },
    data: loanUpdate,
  });

  return { loanApplication, submission };
}

module.exports = {
  findIncompleteApplication,
  saveIncompleteApplication,
  getIncompleteApplication,
  promoteIncompleteApplication,
  incompleteAccessWhere,
};
