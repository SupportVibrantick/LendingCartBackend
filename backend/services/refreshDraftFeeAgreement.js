const generateAgreementHtml = require("../routes/broker/loanPipeline/feeAgreement/generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  buildBrandingSnapshot,
  resolveAgreementBranding,
} = require("./brokerBranding");
const {
  mergeMissingFeeAgreementFields,
  hasResolvableFieldGaps,
  loadOrgBrokerUser,
  resolveFeeAgreementSnapshot,
} = require("./feeAgreementFieldResolver");

async function loadLatestCompletedSubmission(prisma, loanApplicationId) {
  return prisma.applicationSubmission.findFirst({
    where: {
      applicationId: loanApplicationId,
      status: "COMPLETED",
    },
    include: { fields: true },
    orderBy: { createdAt: "desc" },
  });
}

async function buildResolvedFeeAgreementContext(prisma, feeAgreement, loanApplication) {
  const submission = await loadLatestCompletedSubmission(
    prisma,
    feeAgreement.loanApplicationId,
  );

  const primaryContact =
    loanApplication?.client?.contacts?.find((contact) => contact.isPrimary) ||
    loanApplication?.client?.contacts?.[0] ||
    null;

  const orgBrokerUser = await loadOrgBrokerUser(
    prisma,
    feeAgreement.brokerOrgId,
    loanApplication?.brokerUserId || loanApplication?.brokerUser?.id,
  );

  const resolvedSnapshot = resolveFeeAgreementSnapshot({
    loanApplication: {
      ...loanApplication,
      submissions: submission ? [submission] : [],
    },
    submission,
    primaryContact,
    orgBrokerUser,
  });

  const whiteLabelBranding = await getBrokerWhiteLabelBranding(
    prisma,
    feeAgreement.brokerOrgId,
  );

  const branding = resolveAgreementBranding(feeAgreement, whiteLabelBranding);
  const brandingSnapshot = buildBrandingSnapshot(
    whiteLabelBranding,
    loanApplication?.brokerOrg?.name,
  );

  const merged = mergeMissingFeeAgreementFields(feeAgreement, {
    ...resolvedSnapshot,
    brokerLogoUrl: branding.brokerLogoUrl || brandingSnapshot.brokerLogoUrl,
    brokerBrandName: branding.brokerBrandName || brandingSnapshot.brokerBrandName,
  });

  return {
    submission,
    primaryContact,
    orgBrokerUser,
    resolvedSnapshot,
    merged,
    whiteLabelBranding,
  };
}

async function refreshDraftFeeAgreementIfNeeded(prisma, feeAgreement, loanApplication) {
  if (!feeAgreement || feeAgreement.status !== "DRAFT") {
    return feeAgreement;
  }

  const { merged, whiteLabelBranding } = await buildResolvedFeeAgreementContext(
    prisma,
    feeAgreement,
    loanApplication,
  );

  if (!hasResolvableFieldGaps(feeAgreement, merged)) {
    return feeAgreement;
  }

  const agreementHtml = generateAgreementHtml({
    ...merged,
    createdAt: feeAgreement.createdAt,
  });

  return prisma.feeAgreement.update({
    where: { id: feeAgreement.id },
    data: {
      clientName: merged.clientName,
      clientEntityName: merged.clientEntityName,
      clientEmail: merged.clientEmail,
      clientPhone: merged.clientPhone,
      clientAddress: merged.clientAddress,
      subjectAddress: merged.subjectAddress,
      brokerName: merged.brokerName,
      brokerCompany: merged.brokerCompany,
      brokerEmail: merged.brokerEmail,
      brokerPhone: merged.brokerPhone,
      brokerAddress: merged.brokerAddress,
      brokerState: merged.brokerState,
      brokerCounty: merged.brokerCounty,
      brokerLogoUrl: merged.brokerLogoUrl,
      brokerBrandName: merged.brokerBrandName,
      agreementHtml,
    },
  });
}

module.exports = {
  loadLatestCompletedSubmission,
  buildResolvedFeeAgreementContext,
  refreshDraftFeeAgreementIfNeeded,
};
