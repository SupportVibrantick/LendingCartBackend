const path = require("path");
const crypto = require("crypto");
const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../../utils/documents/formatSignDocument");
const {
  applyDocumentSendStatusUpdates,
} = require("../documents/applyDocumentSendStatusUpdates");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../../utils/lender/lenderDocumentDelivery");
const {
  notifyClientSignDocumentRequested,
  notifyLenderSignedDocumentForwarded,
} = require("./signForm/signDocumentNotify");
const { isDynamicForm } = require("../../utils/documents/signDocumentWorkflow");
const {
  ALLOWED_MIME_TYPES,
  writeSignAssetFromStream,
} = require("./signForm/storage");
const {
  autoPublishAcroFormIfPresent,
} = require("./signForm/autoPublishAcroForm");

const SIGN_REQUIREMENT_INCLUDE = {
  documentType: true,
  uploads: { where: { isSignedOutput: true } },
  requestApplicationLender: {
    include: REQUEST_APPLICATION_LENDER_INCLUDE,
  },
  activeFormVersion: true,
  signFormSubmissions: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { values: true },
  },
};

async function listForwardableLendersForApplication(prisma, loanApplicationId) {
  const lenders = await prisma.applicationLender.findMany({
    where: {
      loanApplicationId,
      status: { notIn: ["DECLINED", "WITHDRAWN"] },
    },
    include: { lender: { select: { name: true } } },
    orderBy: { sentAt: "asc" },
  });

  return lenders
    .filter((row) => canLenderReceiveDocuments(row.status))
    .map((row) => ({
      applicationLenderId: row.id,
      lenderName: row.lender?.name || "Lender",
      status: row.status,
    }));
}

function normalizeLenderIdList(body = {}, requirement = null) {
  const fromArray = Array.isArray(body.applicationLenderIds)
    ? body.applicationLenderIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }

  const single =
    body.applicationLenderId ||
    requirement?.requestApplicationLenderId ||
    null;

  return single ? [String(single)] : [];
}

async function validateForwardLenderIds(
  prisma,
  loanApplicationId,
  applicationLenderIds,
) {
  if (!applicationLenderIds.length) {
    const err = new Error("Select at least one eligible lender to forward to");
    err.statusCode = 400;
    throw err;
  }

  const lenders = await prisma.applicationLender.findMany({
    where: {
      id: { in: applicationLenderIds },
      loanApplicationId,
    },
    include: { lender: { select: { name: true } } },
  });

  if (lenders.length !== applicationLenderIds.length) {
    const err = new Error("One or more selected lenders are invalid for this application");
    err.statusCode = 400;
    throw err;
  }

  const blocked = lenders.find((lender) => !canLenderReceiveDocuments(lender.status));
  if (blocked) {
    const err = new Error(getLenderDocumentDeliveryBlockMessage(blocked.status));
    err.statusCode = 400;
    throw err;
  }

  return lenders;
}

async function resetDynamicFormForResend(prisma, requirement) {
  if (
    requirement.signStatus !== "CLIENT_SIGNED" ||
    requirement.signMode !== "DYNAMIC_FORM"
  ) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.applicationDocumentUpload.deleteMany({
      where: {
        documentRequirementId: requirement.id,
        isSignedOutput: true,
      },
    });
    await tx.signFormSubmission.updateMany({
      where: { requirementId: requirement.id },
      data: {
        status: "DRAFT",
        submittedAt: null,
      },
    });
  });
}

async function sendSignRequirementToClient(
  prisma,
  {
    requirement,
    submission,
    brokerFirstName,
    io,
    logger,
  },
) {
  if (!requirement.templateFileUrl) {
    const err = new Error("Template file missing for this document");
    err.statusCode = 400;
    throw err;
  }

  if (
    requirement.signMode === "DYNAMIC_FORM" &&
    !requirement.activeFormVersionId
  ) {
    const err = new Error(
      "Fillable form fields must be published before sending to client",
    );
    err.statusCode = 400;
    throw err;
  }

  if (
    requirement.signStatus === "FORWARDED_TO_LENDER" ||
    requirement.signStatus === "LENDER_SEEN"
  ) {
    const err = new Error("Document already forwarded to lender");
    err.statusCode = 400;
    throw err;
  }

  await resetDynamicFormForResend(prisma, requirement);

  const updated = await prisma.applicationDocumentRequirement.update({
    where: { id: requirement.id },
    data: {
      signStatus: "SENT_TO_CLIENT",
      sentToClientAt: new Date(),
      status: "PENDING",
      clientSignedAt: null,
    },
    include: SIGN_REQUIREMENT_INCLUDE,
  });

  const client = submission.application.client;
  await notifyClientSignDocumentRequested({
    prisma,
    io,
    requirement,
    client,
    application: submission.application,
    brokerFirstName,
    logger,
  });

  return updated;
}

async function forwardSignRequirementToLenders(
  prisma,
  {
    requirement,
    submission,
    applicationLenderIds,
    io,
    logger,
  },
) {
  if (requirement.signStatus !== "CLIENT_SIGNED") {
    const err = new Error(
      requirement.signMode === "DYNAMIC_FORM"
        ? "Form must be fully completed by client and broker before forwarding"
        : "Client must sign the document before forwarding",
    );
    err.statusCode = 400;
    throw err;
  }

  const signedUpload = (requirement.uploads || []).find((u) => u.isSignedOutput);
  if (!signedUpload) {
    const err = new Error("Signed file not found");
    err.statusCode = 400;
    throw err;
  }

  const lenders = await validateForwardLenderIds(
    prisma,
    submission.application.id,
    applicationLenderIds,
  );

  await prisma.applicationDocumentSubmission.createMany({
    data: lenders.map((lender) => ({
      documentUploadId: signedUpload.id,
      applicationLenderId: lender.id,
    })),
    skipDuplicates: true,
  });

  await prisma.applicationDocumentUpload.update({
    where: { id: signedUpload.id },
    data: {
      isSubmittedToLender: true,
      submittedAt: new Date(),
    },
  });

  const updated = await prisma.applicationDocumentRequirement.update({
    where: { id: requirement.id },
    data: {
      signStatus: "FORWARDED_TO_LENDER",
      status: "COMPLETE",
    },
    include: SIGN_REQUIREMENT_INCLUDE,
  });

  await applyDocumentSendStatusUpdates(prisma, {
    loanApplicationId: submission.application.id,
    applicationLenderIds: lenders.map((lender) => lender.id),
  });

  const documentTypeName =
    requirement.signDocumentTitle ||
    requirement.documentType?.name ||
    "Signed document";

  for (const lender of lenders) {
    await notifyLenderSignedDocumentForwarded({
      prisma,
      io,
      applicationLenderId: lender.id,
      loanApplicationId: submission.application.id,
      applicationNumber: submission.application.applicationNumber,
      documentTypeName,
      isForm: isDynamicForm(requirement),
    });
  }

  return {
    updated,
    forwardedCount: lenders.length,
    lenderNames: lenders.map((lender) => lender.lender?.name || "Lender"),
  };
}

async function uploadBrokerSignDocument(
  prisma,
  {
    submission,
    brokerOrgId,
    userId,
    parts,
    logger,
  },
) {
  let documentName = "";
  let uploadedFileMeta = null;
  const loanApplicationId = submission.application.id;

  for await (const part of parts) {
    if (part.type === "field" && part.fieldname === "documentName") {
      documentName = String(part.value || "").trim();
      continue;
    }

    if (part.type !== "file" || part.fieldname !== "file") {
      if (part.type === "file") {
        await part.toBuffer();
      }
      continue;
    }

    if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
      await part.toBuffer();
      const err = new Error("Only PDF or image files are allowed");
      err.statusCode = 400;
      throw err;
    }

    const ext =
      path.extname(part.filename || "") ||
      (part.mimetype === "application/pdf" ? ".pdf" : "");
    const safeFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const stored = await writeSignAssetFromStream({
      relativeParts: ["loan-documents", loanApplicationId, "sign-templates"],
      filename: safeFileName,
      stream: part.file,
      mimeType: part.mimetype,
    });

    uploadedFileMeta = {
      filename: part.filename || documentName || "Sign Document",
      mimetype: part.mimetype,
      templateFileUrl: stored.publicUrl,
    };
  }

  if (!documentName) {
    const err = new Error("Document name is required");
    err.statusCode = 400;
    throw err;
  }

  if (!uploadedFileMeta) {
    const err = new Error("Template file is required");
    err.statusCode = 400;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    let documentType = await tx.documentType.findFirst({
      where: {
        name: documentName,
        createdByOrgId: brokerOrgId,
      },
    });

    if (!documentType) {
      documentType = await tx.documentType.create({
        data: {
          name: documentName,
          code: `BROKER_SIGN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          isCustom: true,
          createdByOrgId: brokerOrgId,
          isActive: true,
        },
      });
    }

    return tx.applicationDocumentRequirement.create({
      data: {
        loanApplicationId,
        documentTypeId: documentType.id,
        source: "BROKER_ADDED",
        isRequired: true,
        status: "PENDING",
        lastRequestedAt: new Date(),
        requiresClientSignature: true,
        signDocumentTitle: documentName,
        templateFileName: uploadedFileMeta.filename,
        templateFileUrl: uploadedFileMeta.templateFileUrl,
        templateMimeType: uploadedFileMeta.mimetype,
        signStatus: "AWAITING_BROKER",
        requestApplicationLenderId: null,
      },
      include: SIGN_REQUIREMENT_INCLUDE,
    });
  });

  const autoPublish = await autoPublishAcroFormIfPresent(prisma, {
    requirement: result,
    organizationId: brokerOrgId,
    userId: userId || null,
    logger,
  });

  const refreshed = await prisma.applicationDocumentRequirement.findUnique({
    where: { id: result.id },
    include: SIGN_REQUIREMENT_INCLUDE,
  });

  return {
    requirement: refreshed || result,
    autoPublish,
    message: autoPublish.published
      ? `Form uploaded with ${autoPublish.fieldCount} fillable field${autoPublish.fieldCount === 1 ? "" : "s"} — you can fill before sending to the client`
      : "Form uploaded. No fillable fields found — use Map fields, or prepare a fillable PDF with free PDF24 Form Editor and re-upload.",
  };
}

async function bulkSendSignDocumentsToClient(
  prisma,
  {
    submission,
    requirementIds,
    brokerFirstName,
    io,
    logger,
  },
) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(requirementIds) ? requirementIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];

  if (!uniqueIds.length) {
    const err = new Error("Select at least one document to send");
    err.statusCode = 400;
    throw err;
  }

  const requirements = await prisma.applicationDocumentRequirement.findMany({
    where: {
      id: { in: uniqueIds },
      loanApplicationId: submission.application.id,
      requiresClientSignature: true,
    },
    include: SIGN_REQUIREMENT_INCLUDE,
  });

  if (requirements.length !== uniqueIds.length) {
    const err = new Error("One or more selected documents were not found");
    err.statusCode = 404;
    throw err;
  }

  const results = [];
  for (const requirement of requirements) {
    if (requirement.signStatus !== "AWAITING_BROKER") {
      continue;
    }
    const updated = await sendSignRequirementToClient(prisma, {
      requirement,
      submission,
      brokerFirstName,
      io,
      logger,
    });
    results.push(updated);
  }

  if (!results.length) {
    const err = new Error(
      "No selected documents are ready to send to the client",
    );
    err.statusCode = 400;
    throw err;
  }

  return results;
}

async function bulkForwardSignDocumentsToLenders(
  prisma,
  {
    submission,
    requirementIds,
    applicationLenderIds,
    io,
    logger,
  },
) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(requirementIds) ? requirementIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];

  if (!uniqueIds.length) {
    const err = new Error("Select at least one document to forward");
    err.statusCode = 400;
    throw err;
  }

  const lenderIds = normalizeLenderIdList({ applicationLenderIds });
  await validateForwardLenderIds(prisma, submission.application.id, lenderIds);

  const requirements = await prisma.applicationDocumentRequirement.findMany({
    where: {
      id: { in: uniqueIds },
      loanApplicationId: submission.application.id,
      requiresClientSignature: true,
      signStatus: "CLIENT_SIGNED",
    },
    include: {
      documentType: true,
      uploads: { where: { isSignedOutput: true } },
      requestApplicationLender: true,
    },
  });

  if (!requirements.length) {
    const err = new Error(
      "No selected documents are ready to forward to lenders",
    );
    err.statusCode = 400;
    throw err;
  }

  const forwarded = [];
  for (const requirement of requirements) {
    const result = await forwardSignRequirementToLenders(prisma, {
      requirement,
      submission,
      applicationLenderIds: lenderIds,
      io,
      logger,
    });
    forwarded.push(result);
  }

  return {
    forwardedCount: forwarded.length,
    lenderCount: lenderIds.length,
    lenderNames: forwarded[0]?.lenderNames || [],
  };
}

module.exports = {
  SIGN_REQUIREMENT_INCLUDE,
  listForwardableLendersForApplication,
  normalizeLenderIdList,
  sendSignRequirementToClient,
  forwardSignRequirementToLenders,
  uploadBrokerSignDocument,
  bulkSendSignDocumentsToClient,
  bulkForwardSignDocumentsToLenders,
  formatSignDocumentRequirement,
};
