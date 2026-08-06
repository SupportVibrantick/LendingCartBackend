const sendMail = require("../../services/emails/mail");
const { loadTemplate } = require("../email/loadTemplate");
const { buildClientLinkEmailData } = require("../email/emailTemplateData");
const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../documents/formatSignDocument");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../services/notifications/clientNotifications");
const {
  forwardBrokerLoiRequiredDocumentsToClient,
  extractStoredBrokerLoiDocumentNames,
} = require("../../services/loi/syncLoiRequiredDocuments");
const {
  applyDocumentSendStatusUpdates,
} = require("../../services/documents/applyDocumentSendStatusUpdates");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../lender/lenderDocumentDelivery");
const {
  notifyLendersForForwardedDocument,
} = require("../../services/notifications/lenderNotifications");
const {
  resolveLatestActiveSubmission,
} = require("../applications/clientPortalSubmission");
const { buildClientPortalUrl } = require("../email/emailBranding");
const {
  markBrokerLoiVersionSentToClient,
  markBrokerLoiVersionForwardedToLender,
  markBrokerLoiVersionClientSigned,
  getCurrentBrokerLoiVersion,
} = require("../../services/loi/loiVersionService");const BROKER_LOI_SIGN_TITLE = "Broker LOI / Term Sheet";
const BROKER_LOI_DOC_CODE = "BROKER_LOI_TERM_SHEET";

async function getOrCreateBrokerLoiDocumentType(prisma, brokerOrgId) {
  let documentType = await prisma.documentType.findFirst({
    where: {
      code: BROKER_LOI_DOC_CODE,
      createdByOrgId: brokerOrgId,
    },
  });

  if (!documentType) {
    documentType = await prisma.documentType.create({
      data: {
        name: BROKER_LOI_SIGN_TITLE,
        code: BROKER_LOI_DOC_CODE,
        isCustom: true,
        createdByOrgId: brokerOrgId,
        isActive: true,
        description: "Broker-branded LOI/term sheet for client signature",
      },
    });
  }

  return documentType;
}

async function findBrokerLoiSignRequirement(prisma, applicationId, brokerOrgId) {
  const documentType = await prisma.documentType.findFirst({
    where: {
      code: BROKER_LOI_DOC_CODE,
      createdByOrgId: brokerOrgId,
    },
  });

  if (!documentType) return null;

  return prisma.applicationDocumentRequirement.findFirst({
    where: {
      loanApplicationId: applicationId,
      documentTypeId: documentType.id,
      requiresClientSignature: true,
    },
    include: {
      documentType: true,
      uploads: {
        where: { isSignedOutput: true },
        orderBy: { uploadedAt: "desc" },
      },
      requestApplicationLender: {
        include: REQUEST_APPLICATION_LENDER_INCLUDE,
      },
    },
  });
}

async function upsertBrokerLoiSignRequirement(
  prisma,
  {
    applicationId,
    brokerOrgId,
    sourceApplicationLenderId,
    brokerLoiUrl,
    fileName,
    isRevised = false,
  },
) {
  const documentType = await getOrCreateBrokerLoiDocumentType(prisma, brokerOrgId);
  const existing = await findBrokerLoiSignRequirement(
    prisma,
    applicationId,
    brokerOrgId,
  );

  if (
    existing &&
    !isRevised &&
    (existing.signStatus === "CLIENT_SIGNED" ||
      existing.signStatus === "FORWARDED_TO_LENDER" ||
      existing.signStatus === "LENDER_SEEN")
  ) {
    return {
      error: {
        status: 400,
        message:
          "Broker LOI is locked after client signature. Create a revised LOI (new version) instead.",
        code: "LOI_LOCKED",
      },
    };
  }

  const sharedData = {
    templateFileName: fileName,
    templateFileUrl: brokerLoiUrl,
    templateMimeType: "application/pdf",
    requestApplicationLenderId: sourceApplicationLenderId,
    signDocumentTitle: BROKER_LOI_SIGN_TITLE,
    requiresClientSignature: true,
    source: "BROKER_ADDED",
    isRequired: true,
    status: "PENDING",
    lastRequestedAt: new Date(),
    signStatus: "AWAITING_BROKER",
    sentToClientAt: null,
    clientSignedAt: null,
  };

  if (existing) {
    if (!isRevised) {
      const signedUploadIds = (existing.uploads || [])
        .filter((upload) => upload.isSignedOutput)
        .map((upload) => upload.id);

      if (signedUploadIds.length > 0) {
        const submissionCount = await prisma.applicationDocumentSubmission.count({
          where: { documentUploadId: { in: signedUploadIds } },
        });

        if (submissionCount === 0) {
          await prisma.applicationDocumentUpload.deleteMany({
            where: {
              documentRequirementId: existing.id,
              isSignedOutput: true,
            },
          });
        }
      }
    }

    return prisma.applicationDocumentRequirement.update({
      where: { id: existing.id },
      data: sharedData,
      include: {
        documentType: true,
        uploads: { where: { isSignedOutput: true } },
        requestApplicationLender: {
          include: REQUEST_APPLICATION_LENDER_INCLUDE,
        },
      },
    });
  }

  return prisma.applicationDocumentRequirement.create({
    data: {
      loanApplicationId: applicationId,
      documentTypeId: documentType.id,
      ...sharedData,
    },
    include: {
      documentType: true,
      uploads: { where: { isSignedOutput: true } },
      requestApplicationLender: {
        include: REQUEST_APPLICATION_LENDER_INCLUDE,
      },
    },
  });
}

function buildSignWorkflowPayload(requirement, submissionId) {
  if (!requirement) {
    return {
      requirementId: null,
      submissionId: submissionId || null,
      signStatus: null,
      signStatusLabel: null,
      sentToClientAt: null,
      clientSignedAt: null,
      signedPdfUrl: null,
      canSendToClient: false,
      canForwardToLender: false,
    };
  }

  const formatted = formatSignDocumentRequirement(requirement, {
    viewer: "broker",
  });
  const showSignedUpload = [
    "CLIENT_SIGNED",
    "FORWARDED_TO_LENDER",
    "LENDER_SEEN",
  ].includes(requirement.signStatus);
  const signedUpload = showSignedUpload ? formatted.signedUpload : null;

  return {
    requirementId: requirement.id,
    submissionId: submissionId || null,
    signStatus: requirement.signStatus,
    signStatusLabel: formatted.signStatusLabel,
    sentToClientAt: requirement.sentToClientAt,
    clientSignedAt: requirement.clientSignedAt,
    signedPdfUrl: signedUpload?.fileUrl || null,
    signedPdfFileName: signedUpload?.fileName || null,
    canSendToClient:
      requirement.signStatus === "AWAITING_BROKER" &&
      Boolean(requirement.templateFileUrl),
    canForwardToLender: requirement.signStatus === "CLIENT_SIGNED",
    isLocked:
      requirement.signStatus === "CLIENT_SIGNED" ||
      requirement.signStatus === "FORWARDED_TO_LENDER" ||
      requirement.signStatus === "LENDER_SEEN",
    isComplete:
      requirement.signStatus === "FORWARDED_TO_LENDER" ||
      requirement.signStatus === "LENDER_SEEN",
  };
}

async function getSignedBrokerLoiForLender(
  prisma,
  { applicationLenderId, lenderOrgId },
) {
  const applicationLender = await prisma.applicationLender.findFirst({
    where: {
      id: applicationLenderId,
      lenderOrgId,
    },
    select: {
      id: true,
      loanApplicationId: true,
      loanApplication: {
        select: {
          applicationNumber: true,
          brokerOrgId: true,
          brokerLoiSourceApplicationLenderId: true,
        },
      },
    },
  });

  if (!applicationLender) {
    return { error: { status: 404, message: "Application not found" } };
  }

  const brokerLoiVersions = await prisma.brokerLoiVersion.findMany({
    where: {
      loanApplicationId: applicationLender.loanApplicationId,
      status: "FORWARDED_TO_LENDER",
      signedPdfUrl: { not: null },
    },
    orderBy: { versionNumber: "desc" },
  });

  const latestForwardedVersion =
    brokerLoiVersions.find(
      (version) => version.sourceApplicationLenderId === applicationLenderId,
    ) ||
    (applicationLender.loanApplication.brokerLoiSourceApplicationLenderId ===
    applicationLenderId
      ? brokerLoiVersions[0]
      : null);

  if (latestForwardedVersion?.signedPdfUrl) {
    return {
      data: {
        requirementId: latestForwardedVersion.documentRequirementId,
        documentName: BROKER_LOI_SIGN_TITLE,
        signStatus: "FORWARDED_TO_LENDER",
        signStatusLabel: "Forwarded to lender",
        clientSignedAt: latestForwardedVersion.clientSignedAt,
        versionNumber: latestForwardedVersion.versionNumber,
        versionLabel: `Version ${latestForwardedVersion.versionNumber}`,
        signedUpload: {
          uploadId: null,
          fileName: `Signed-Broker-LOI-v${latestForwardedVersion.versionNumber}.pdf`,
          fileUrl: latestForwardedVersion.signedPdfUrl,
          fileMimeType: "application/pdf",
          uploadedAt: latestForwardedVersion.clientSignedAt,
          clientSignatureData: null,
        },
      },
    };
  }

  const documentType = await prisma.documentType.findFirst({
    where: {
      code: BROKER_LOI_DOC_CODE,
      createdByOrgId: applicationLender.loanApplication.brokerOrgId,
    },
  });

  if (!documentType) {
    return { data: null };
  }

  let requirement = await prisma.applicationDocumentRequirement.findFirst({
    where: {
      loanApplicationId: applicationLender.loanApplicationId,
      documentTypeId: documentType.id,
      requiresClientSignature: true,
      requestApplicationLenderId: applicationLenderId,
      signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
    },
    include: {
      documentType: true,
      uploads: {
        where: { isSignedOutput: true },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (
    !requirement &&
    applicationLender.loanApplication.brokerLoiSourceApplicationLenderId ===
      applicationLenderId
  ) {
    requirement = await prisma.applicationDocumentRequirement.findFirst({
      where: {
        loanApplicationId: applicationLender.loanApplicationId,
        documentTypeId: documentType.id,
        requiresClientSignature: true,
        signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
      },
      include: {
        documentType: true,
        uploads: {
          where: { isSignedOutput: true },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });
  }

  if (!requirement) {
    return { data: null };
  }

  const formatted = formatSignDocumentRequirement(requirement, {
    viewer: "lender",
  });

  return {
    data: {
      requirementId: requirement.id,
      documentName: formatted.documentName,
      signStatus: requirement.signStatus,
      signStatusLabel: formatted.signStatusLabel,
      clientSignedAt: requirement.clientSignedAt,
      signedUpload: formatted.signedUpload,
    },
  };
}

async function loadBrokerLoiSignContext(
  prisma,
  { applicationId, brokerOrgId, brokerUserId },
) {
  const where = {
    id: applicationId,
    brokerOrgId,
  };

  if (brokerUserId) {
    where.brokerUserId = brokerUserId;
  }

  const application = await prisma.loanApplication.findFirst({
    where,
    include: {
      client: { include: { contacts: true } },
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) {
    return { error: { status: 404, message: "Application not found" } };
  }

  const submission = resolveLatestActiveSubmission(application.submissions || []);
  const requirement = await findBrokerLoiSignRequirement(
    prisma,
    applicationId,
    brokerOrgId,
  );

  return {
    application,
    submission,
    requirement,
  };
}

async function sendBrokerLoiToClient(
  prisma,
  io,
  {
    applicationId,
    brokerOrgId,
    brokerUserId,
    brokerUser,
  },
) {
  const context = await loadBrokerLoiSignContext(prisma, {
    applicationId,
    brokerOrgId,
    brokerUserId,
  });

  if (context.error) return context;

  const { application, submission, requirement } = context;

  if (!application.brokerLoiUrl) {
    return {
      error: { status: 400, message: "Generate a broker LOI before sending to client" },
    };
  }

  if (!requirement) {
    return {
      error: {
        status: 400,
        message: "Broker LOI sign requirement not found. Regenerate the broker LOI.",
      },
    };
  }

  if (!requirement.templateFileUrl) {
    return {
      error: { status: 400, message: "Broker LOI file is missing" },
    };
  }

  if (
    requirement.signStatus === "CLIENT_SIGNED" ||
    requirement.signStatus === "FORWARDED_TO_LENDER" ||
    requirement.signStatus === "LENDER_SEEN"
  ) {
    return {
      error: {
        status: 400,
        message: "Broker LOI is already signed or forwarded",
      },
    };
  }

  const updated = await prisma.applicationDocumentRequirement.update({
    where: { id: requirement.id },
    data: {
      signStatus: "SENT_TO_CLIENT",
      sentToClientAt: new Date(),
      status: "PENDING",
    },
    include: {
      documentType: true,
      uploads: { where: { isSignedOutput: true } },
      requestApplicationLender: {
        include: REQUEST_APPLICATION_LENDER_INCLUDE,
      },
    },
  });

  const currentVersion = await getCurrentBrokerLoiVersion(
    prisma,
    applicationId,
  );
  if (currentVersion?.id) {
    await markBrokerLoiVersionSentToClient(prisma, currentVersion.id);
  }

  const brokerLoiDocumentNames = extractStoredBrokerLoiDocumentNames(
    application.brokerLoiTerms,
  );

  let forwardedDocuments = { forwardedCount: 0, newlyForwardedCount: 0 };
  if (brokerLoiDocumentNames.length > 0) {
    try {
      forwardedDocuments = await forwardBrokerLoiRequiredDocumentsToClient(
        prisma,
        {
          loanApplicationId: applicationId,
          documentNames: brokerLoiDocumentNames,
          orgId: brokerOrgId,
          excludeDocumentTypeIds: [requirement.documentTypeId],
        },
      );
    } catch (forwardError) {
      console.error(
        "Failed to forward broker LOI required documents to client:",
        forwardError,
      );
    }
  }

  const client = application.client;
  const contact =
    client?.contacts?.find((item) => item.isPrimary && item.email) ||
    client?.contacts?.find((item) => item.email);
  const clientEmail = contact?.email;
  const uploadDocCount = forwardedDocuments.newlyForwardedCount || 0;

  if (client?.id) {
    const bodyParts = [
      `Please review and sign your broker LOI / term sheet for application ${application.applicationNumber || ""}`.trim(),
    ];
    if (uploadDocCount > 0) {
      bodyParts.push(
        `${uploadDocCount} supporting document(s) from your term sheet are also ready to upload in the client portal.`,
      );
    }

    await notifyClient(prisma, io, {
      clientId: client.id,
      eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
      category: "DOCUMENTS",
      subject: "Broker LOI signature required",
      body: bodyParts.join(" "),
      metadata: {
        loanApplicationId: application.id,
        applicationId: application.id,
        requirementId: requirement.id,
        signDocument: true,
        brokerLoi: true,
        forwardedDocumentCount: forwardedDocuments.forwardedCount,
      },
    });
  }

  if (clientEmail) {
    const portalLink = buildClientPortalUrl({ path: "/client-portal" });
    const html = loadTemplate(
      "broker/clientLink",
      buildClientLinkEmailData({
        clientName: client?.legalName,
        uploadLink: portalLink,
        applicationNumber: application.applicationNumber,
        brokerName: brokerUser?.firstName,
        message:
          uploadDocCount > 0
            ? "Please sign your broker LOI / term sheet and upload the supporting documents listed in the client portal."
            : "Please sign your broker LOI / term sheet in the client portal.",
        preset: "signatureRequired",
      }),
    );

    try {
      await sendMail({
        to: clientEmail,
        subject: "Signature required: Broker LOI / Term Sheet",
        html,
      });
    } catch (mailErr) {
      console.warn("Broker LOI client email failed:", mailErr.message);
    }
  }

  return {
    data: {
      signWorkflow: buildSignWorkflowPayload(updated, submission?.id || null),
      formatted: formatSignDocumentRequirement(updated, { viewer: "broker" }),
    },
  };
}

async function forwardBrokerLoiToLender(
  prisma,
  io,
  { applicationId, brokerOrgId, brokerUserId },
) {
  const context = await loadBrokerLoiSignContext(prisma, {
    applicationId,
    brokerOrgId,
    brokerUserId,
  });

  if (context.error) return context;

  const { submission, requirement } = context;

  if (!requirement) {
    return {
      error: { status: 404, message: "Broker LOI sign requirement not found" },
    };
  }

  if (requirement.signStatus !== "CLIENT_SIGNED") {
    return {
      error: {
        status: 400,
        message: "Client must sign the broker LOI before forwarding to lender",
      },
    };
  }

  const signedUpload = requirement.uploads?.[0];
  if (!signedUpload) {
    return {
      error: { status: 400, message: "Signed broker LOI file not found" },
    };
  }

  const applicationLenderId =
    requirement.requestApplicationLenderId ||
    context.application.brokerLoiSourceApplicationLenderId;

  if (!applicationLenderId) {
    return {
      error: {
        status: 400,
        message: "Funding lender not linked to broker LOI",
      },
    };
  }

  if (
    requirement.requestApplicationLenderId !== applicationLenderId &&
    applicationLenderId
  ) {
    await prisma.applicationDocumentRequirement.update({
      where: { id: requirement.id },
      data: { requestApplicationLenderId: applicationLenderId },
    });
    requirement.requestApplicationLenderId = applicationLenderId;
  }

  const lender = await prisma.applicationLender.findUnique({
    where: { id: applicationLenderId },
  });

  if (!lender || lender.loanApplicationId !== applicationId) {
    return {
      error: { status: 400, message: "Invalid lender for this application" },
    };
  }

  if (!canLenderReceiveDocuments(lender.status)) {
    return {
      error: {
        status: 400,
        message: getLenderDocumentDeliveryBlockMessage(lender.status),
      },
    };
  }

  await prisma.applicationDocumentSubmission.createMany({
    data: [
      {
        documentUploadId: signedUpload.id,
        applicationLenderId,
      },
    ],
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
    include: {
      documentType: true,
      uploads: { where: { isSignedOutput: true } },
      requestApplicationLender: {
        include: REQUEST_APPLICATION_LENDER_INCLUDE,
      },
    },
  });

  const currentVersion = await getCurrentBrokerLoiVersion(
    prisma,
    applicationId,
  );
  if (currentVersion?.id) {
    await markBrokerLoiVersionForwardedToLender(prisma, currentVersion.id);
  }

  await applyDocumentSendStatusUpdates(prisma, {
    loanApplicationId: applicationId,
    applicationLenderIds: [applicationLenderId],
  });

  await notifyLendersForForwardedDocument(prisma, io, {
    applicationLenderIds: [applicationLenderId],
    loanApplicationId: applicationId,
    applicationNumber: context.application.applicationNumber,
    documentTypeName: BROKER_LOI_SIGN_TITLE,
    source: "Broker",
  });

  return {
    data: {
      signWorkflow: buildSignWorkflowPayload(updated, submission?.id || null),
      formatted: formatSignDocumentRequirement(updated, { viewer: "broker" }),
    },
  };
}

module.exports = {
  BROKER_LOI_SIGN_TITLE,
  findBrokerLoiSignRequirement,
  upsertBrokerLoiSignRequirement,
  buildSignWorkflowPayload,
  sendBrokerLoiToClient,
  forwardBrokerLoiToLender,
  getSignedBrokerLoiForLender,
};
