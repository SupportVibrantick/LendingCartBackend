const LENDER_LOI_STATUS = {
  DRAFT: "DRAFT",
  SENT_TO_BROKER: "SENT_TO_BROKER",
  SUPERSEDED: "SUPERSEDED",
};

const BROKER_LOI_STATUS = {
  DRAFT: "DRAFT",
  SENT_TO_CLIENT: "SENT_TO_CLIENT",
  CLIENT_SIGNED: "CLIENT_SIGNED",
  FORWARDED_TO_LENDER: "FORWARDED_TO_LENDER",
  SUPERSEDED: "SUPERSEDED",
};

function formatLenderLoiVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    label: `Version ${version.versionNumber}`,
    loiUrl: version.loiUrl,
    loiTermsJson: version.loiTermsJson,
    status: version.status,
    sentToBrokerAt: version.sentToBrokerAt,
    generatedAt: version.generatedAt,
    supersededAt: version.supersededAt,
    isCurrent: false,
    isLocked: version.status !== LENDER_LOI_STATUS.DRAFT,
  };
}

function formatBrokerLoiVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    label: `Version ${version.versionNumber}`,
    brokerLoiUrl: version.brokerLoiUrl,
    brokerLoiTerms: version.brokerLoiTerms,
    status: version.status,
    sentToClientAt: version.sentToClientAt,
    clientSignedAt: version.clientSignedAt,
    signedPdfUrl: version.signedPdfUrl,
    generatedAt: version.generatedAt,
    supersededAt: version.supersededAt,
    sourceApplicationLenderId: version.sourceApplicationLenderId,
    sourceLenderLoiVersionId: version.sourceLenderLoiVersionId,
    isCurrent: false,
    isLocked: [
      BROKER_LOI_STATUS.CLIENT_SIGNED,
      BROKER_LOI_STATUS.FORWARDED_TO_LENDER,
      BROKER_LOI_STATUS.SUPERSEDED,
    ].includes(version.status),
    canRegenerateDraft:
      version.status === BROKER_LOI_STATUS.DRAFT ||
      version.status === BROKER_LOI_STATUS.SENT_TO_CLIENT,
  };
}

async function getNextLenderLoiVersionNumber(prisma, applicationLenderId) {
  const latest = await prisma.lenderLoiVersion.findFirst({
    where: { applicationLenderId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (latest?.versionNumber || 0) + 1;
}

async function getNextBrokerLoiVersionNumber(prisma, loanApplicationId) {
  const latest = await prisma.brokerLoiVersion.findFirst({
    where: { loanApplicationId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (latest?.versionNumber || 0) + 1;
}

async function listLenderLoiVersions(prisma, applicationLenderId) {
  const versions = await prisma.lenderLoiVersion.findMany({
    where: { applicationLenderId },
    orderBy: { versionNumber: "asc" },
  });

  const lenderRecord = await prisma.applicationLender.findUnique({
    where: { id: applicationLenderId },
    select: { currentLenderLoiVersionId: true },
  });

  return versions.map((version) => ({
    ...formatLenderLoiVersion(version),
    isCurrent: version.id === lenderRecord?.currentLenderLoiVersionId,
  }));
}

async function listBrokerLoiVersions(prisma, loanApplicationId) {
  const versions = await prisma.brokerLoiVersion.findMany({
    where: { loanApplicationId },
    orderBy: { versionNumber: "asc" },
  });

  const application = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: { currentBrokerLoiVersionId: true },
  });

  return versions.map((version) => ({
    ...formatBrokerLoiVersion(version),
    isCurrent: version.id === application?.currentBrokerLoiVersionId,
  }));
}

async function getCurrentLenderLoiVersion(prisma, applicationLenderId) {
  const lenderRecord = await prisma.applicationLender.findUnique({
    where: { id: applicationLenderId },
    select: {
      currentLenderLoiVersionId: true,
      currentLenderLoiVersion: true,
    },
  });

  if (lenderRecord?.currentLenderLoiVersion) {
    return lenderRecord.currentLenderLoiVersion;
  }

  return prisma.lenderLoiVersion.findFirst({
    where: { applicationLenderId },
    orderBy: { versionNumber: "desc" },
  });
}

async function getCurrentBrokerLoiVersion(prisma, loanApplicationId) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      currentBrokerLoiVersionId: true,
      currentBrokerLoiVersion: true,
    },
  });

  if (application?.currentBrokerLoiVersion) {
    return application.currentBrokerLoiVersion;
  }

  return prisma.brokerLoiVersion.findFirst({
    where: { loanApplicationId },
    orderBy: { versionNumber: "desc" },
  });
}

async function updateLenderLoiDraftVersion(
  prisma,
  {
    versionId,
    applicationLenderId,
    loiUrl,
    loiTermsJson,
    generatedByUserId,
  },
) {
  const version = await prisma.lenderLoiVersion.update({
    where: { id: versionId },
    data: {
      loiUrl,
      loiTermsJson,
      generatedByUserId,
    },
  });

  await prisma.applicationLender.update({
    where: { id: applicationLenderId },
    data: {
      loiUrl,
      loiTermsJson,
      currentLenderLoiVersionId: version.id,
      lastUpdatedAt: new Date(),
    },
  });

  return version;
}

async function createLenderLoiVersion(
  prisma,
  {
    applicationLenderId,
    loiUrl,
    loiTermsJson,
    generatedByUserId,
    isRevised = false,
  },
) {
  const versionNumber = await getNextLenderLoiVersionNumber(
    prisma,
    applicationLenderId,
  );

  if (isRevised) {
    await prisma.lenderLoiVersion.updateMany({
      where: {
        applicationLenderId,
        status: LENDER_LOI_STATUS.DRAFT,
      },
      data: {
        status: LENDER_LOI_STATUS.SUPERSEDED,
        supersededAt: new Date(),
      },
    });
  }

  const version = await prisma.lenderLoiVersion.create({
    data: {
      applicationLenderId,
      versionNumber,
      loiUrl,
      loiTermsJson,
      status: LENDER_LOI_STATUS.DRAFT,
      generatedByUserId,
    },
  });

  await prisma.applicationLender.update({
    where: { id: applicationLenderId },
    data: {
      loiUrl,
      loiTermsJson,
      currentLenderLoiVersionId: version.id,
      loiSentToBrokerAt: null,
      lastUpdatedAt: new Date(),
    },
  });

  return version;
}

async function markLenderLoiVersionSentToBroker(prisma, applicationLenderId) {
  const current = await getCurrentLenderLoiVersion(prisma, applicationLenderId);
  if (!current) return null;

  const sentAt = new Date();

  await prisma.lenderLoiVersion.updateMany({
    where: {
      applicationLenderId,
      status: LENDER_LOI_STATUS.SENT_TO_BROKER,
      id: { not: current.id },
    },
    data: {
      status: LENDER_LOI_STATUS.SUPERSEDED,
      supersededAt: sentAt,
    },
  });

  const updated = await prisma.lenderLoiVersion.update({
    where: { id: current.id },
    data: {
      status: LENDER_LOI_STATUS.SENT_TO_BROKER,
      sentToBrokerAt: sentAt,
    },
  });

  await prisma.applicationLender.update({
    where: { id: applicationLenderId },
    data: { loiSentToBrokerAt: sentAt },
  });

  return updated;
}

async function createBrokerLoiVersion(
  prisma,
  {
    loanApplicationId,
    sourceApplicationLenderId,
    sourceLenderLoiVersionId,
    brokerLoiUrl,
    brokerLoiTerms,
    generatedByUserId,
    isRevised = false,
    documentRequirementId = null,
  },
) {
  const versionNumber = await getNextBrokerLoiVersionNumber(
    prisma,
    loanApplicationId,
  );

  if (isRevised) {
    await prisma.brokerLoiVersion.updateMany({
      where: {
        loanApplicationId,
        status: {
          in: [BROKER_LOI_STATUS.DRAFT, BROKER_LOI_STATUS.SENT_TO_CLIENT],
        },
      },
      data: {
        status: BROKER_LOI_STATUS.SUPERSEDED,
        supersededAt: new Date(),
      },
    });
  }

  const version = await prisma.brokerLoiVersion.create({
    data: {
      loanApplicationId,
      sourceApplicationLenderId,
      sourceLenderLoiVersionId,
      versionNumber,
      brokerLoiUrl,
      brokerLoiTerms,
      status: BROKER_LOI_STATUS.DRAFT,
      generatedByUserId,
      documentRequirementId,
    },
  });

  await prisma.loanApplication.update({
    where: { id: loanApplicationId },
    data: {
      brokerLoiUrl,
      brokerLoiTerms,
      brokerLoiSourceApplicationLenderId: sourceApplicationLenderId,
      brokerLoiGeneratedAt: new Date(),
      brokerLoiGeneratedByUserId: generatedByUserId,
      currentBrokerLoiVersionId: version.id,
    },
  });

  return version;
}

async function updateBrokerLoiDraftVersion(
  prisma,
  {
    versionId,
    loanApplicationId,
    brokerLoiUrl,
    brokerLoiTerms,
    generatedByUserId,
    documentRequirementId = null,
  },
) {
  const version = await prisma.brokerLoiVersion.update({
    where: { id: versionId },
    data: {
      brokerLoiUrl,
      brokerLoiTerms,
      generatedByUserId,
      documentRequirementId: documentRequirementId || undefined,
    },
  });

  await prisma.loanApplication.update({
    where: { id: loanApplicationId },
    data: {
      brokerLoiUrl,
      brokerLoiTerms,
      brokerLoiGeneratedAt: new Date(),
      brokerLoiGeneratedByUserId: generatedByUserId,
      currentBrokerLoiVersionId: version.id,
    },
  });

  return version;
}

async function markBrokerLoiVersionSentToClient(prisma, versionId) {
  return prisma.brokerLoiVersion.update({
    where: { id: versionId },
    data: {
      status: BROKER_LOI_STATUS.SENT_TO_CLIENT,
      sentToClientAt: new Date(),
    },
  });
}

async function markBrokerLoiVersionClientSigned(
  prisma,
  versionId,
  signedPdfUrl,
) {
  const signedAt = new Date();
  return prisma.brokerLoiVersion.update({
    where: { id: versionId },
    data: {
      status: BROKER_LOI_STATUS.CLIENT_SIGNED,
      clientSignedAt: signedAt,
      signedPdfUrl,
    },
  });
}

async function markBrokerLoiVersionForwardedToLender(prisma, versionId) {
  return prisma.brokerLoiVersion.update({
    where: { id: versionId },
    data: { status: BROKER_LOI_STATUS.FORWARDED_TO_LENDER },
  });
}

function isBrokerLoiVersionLocked(version) {
  if (!version) return false;
  return [
    BROKER_LOI_STATUS.CLIENT_SIGNED,
    BROKER_LOI_STATUS.FORWARDED_TO_LENDER,
    BROKER_LOI_STATUS.SUPERSEDED,
  ].includes(version.status);
}

function canRegenerateBrokerLoiDraft(version) {
  if (!version) return true;
  return (
    version.status === BROKER_LOI_STATUS.DRAFT ||
    version.status === BROKER_LOI_STATUS.SENT_TO_CLIENT
  );
}

function canCreateRevisedBrokerLoi(version, signRequirement = null) {
  if (isBrokerLoiVersionLocked(version)) return true;
  if (!signRequirement?.signStatus) return false;
  return ["CLIENT_SIGNED", "FORWARDED_TO_LENDER", "LENDER_SEEN"].includes(
    signRequirement.signStatus,
  );
}

function resolveBrokerLoiVersionStatusFromSignWorkflow(signStatus) {
  if (signStatus === "FORWARDED_TO_LENDER" || signStatus === "LENDER_SEEN") {
    return BROKER_LOI_STATUS.FORWARDED_TO_LENDER;
  }
  if (signStatus === "CLIENT_SIGNED") {
    return BROKER_LOI_STATUS.CLIENT_SIGNED;
  }
  if (signStatus === "SENT_TO_CLIENT") {
    return BROKER_LOI_STATUS.SENT_TO_CLIENT;
  }
  return null;
}

async function syncBrokerLoiVersionFromSignWorkflow(
  prisma,
  { applicationId, signRequirement },
) {
  if (!signRequirement?.signStatus) return null;

  const targetStatus = resolveBrokerLoiVersionStatusFromSignWorkflow(
    signRequirement.signStatus,
  );
  if (!targetStatus) return null;

  let version =
    (signRequirement.id
      ? await prisma.brokerLoiVersion.findFirst({
          where: { documentRequirementId: signRequirement.id },
        })
      : null) || (await getCurrentBrokerLoiVersion(prisma, applicationId));

  if (!version) return null;

  const signedUpload = signRequirement.uploads?.[0];
  const signedPdfUrl = signedUpload?.fileUrl || version.signedPdfUrl || null;
  const needsStatusSync = version.status !== targetStatus;
  const needsRequirementLink =
    signRequirement.id && version.documentRequirementId !== signRequirement.id;
  const needsSignedPdf = signedPdfUrl && version.signedPdfUrl !== signedPdfUrl;
  const needsSentAt =
    signRequirement.sentToClientAt &&
    !version.sentToClientAt &&
    (targetStatus === BROKER_LOI_STATUS.SENT_TO_CLIENT ||
      targetStatus === BROKER_LOI_STATUS.CLIENT_SIGNED ||
      targetStatus === BROKER_LOI_STATUS.FORWARDED_TO_LENDER);
  const needsSignedAt =
    signRequirement.clientSignedAt &&
    !version.clientSignedAt &&
    (targetStatus === BROKER_LOI_STATUS.CLIENT_SIGNED ||
      targetStatus === BROKER_LOI_STATUS.FORWARDED_TO_LENDER);

  if (
    !needsStatusSync &&
    !needsRequirementLink &&
    !needsSignedPdf &&
    !needsSentAt &&
    !needsSignedAt
  ) {
    return version;
  }

  return prisma.brokerLoiVersion.update({
    where: { id: version.id },
    data: {
      status: targetStatus,
      documentRequirementId: signRequirement.id || version.documentRequirementId,
      sentToClientAt:
        version.sentToClientAt ||
        signRequirement.sentToClientAt ||
        undefined,
      clientSignedAt:
        version.clientSignedAt ||
        signRequirement.clientSignedAt ||
        undefined,
      signedPdfUrl: signedPdfUrl || version.signedPdfUrl || undefined,
    },
  });
}

function canCreateRevisedLenderLoi(currentVersion) {
  if (!currentVersion) return false;
  return currentVersion.status !== LENDER_LOI_STATUS.DRAFT;
}

module.exports = {
  LENDER_LOI_STATUS,
  BROKER_LOI_STATUS,
  formatLenderLoiVersion,
  formatBrokerLoiVersion,
  listLenderLoiVersions,
  listBrokerLoiVersions,
  getCurrentLenderLoiVersion,
  getCurrentBrokerLoiVersion,
  createLenderLoiVersion,
  updateLenderLoiDraftVersion,
  markLenderLoiVersionSentToBroker,
  createBrokerLoiVersion,
  updateBrokerLoiDraftVersion,
  markBrokerLoiVersionSentToClient,
  markBrokerLoiVersionClientSigned,
  markBrokerLoiVersionForwardedToLender,
  isBrokerLoiVersionLocked,
  canRegenerateBrokerLoiDraft,
  canCreateRevisedBrokerLoi,
  syncBrokerLoiVersionFromSignWorkflow,
  resolveBrokerLoiVersionStatusFromSignWorkflow,
  canCreateRevisedLenderLoi,
  getNextLenderLoiVersionNumber,
  getNextBrokerLoiVersionNumber,
};
