const DEFAULT_PLATFORM_LOGO = null;

async function getBrokerWhiteLabelBranding(prisma, brokerOrgId) {
  if (!brokerOrgId) {
    return {
      brokerLogoUrl: DEFAULT_PLATFORM_LOGO,
      brokerBrandName: null,
    };
  }

  const settings = await prisma.brokerWhiteLabelSetting.findFirst({
    where: { brokerOrgId },
    select: {
      logoUrl: true,
      brandName: true,
    },
  });

  return {
    brokerLogoUrl: settings?.logoUrl || DEFAULT_PLATFORM_LOGO,
    brokerBrandName: settings?.brandName || null,
  };
}

function resolveAgreementBranding(feeAgreement, whiteLabelBranding = null) {
  if (!feeAgreement) {
    return {
      brokerLogoUrl: null,
      brokerBrandName: null,
    };
  }

  const isSigned = feeAgreement.status === "SIGNED";

  if (isSigned) {
    return {
      brokerLogoUrl: feeAgreement.brokerLogoUrl || null,
      brokerBrandName:
        feeAgreement.brokerBrandName || feeAgreement.brokerCompany || null,
    };
  }

  return {
    brokerLogoUrl:
      feeAgreement.brokerLogoUrl || whiteLabelBranding?.brokerLogoUrl || null,
    brokerBrandName:
      feeAgreement.brokerBrandName ||
      whiteLabelBranding?.brokerBrandName ||
      feeAgreement.brokerCompany ||
      null,
  };
}

function buildBrandingSnapshot(whiteLabelBranding, fallbackBrandName = null) {
  return {
    brokerLogoUrl: whiteLabelBranding?.brokerLogoUrl || null,
    brokerBrandName:
      whiteLabelBranding?.brokerBrandName || fallbackBrandName || null,
  };
}

function lockAgreementBranding(feeAgreement, whiteLabelBranding = null) {
  const resolved = resolveAgreementBranding(feeAgreement, whiteLabelBranding);

  return {
    brokerLogoUrl: resolved.brokerLogoUrl,
    brokerBrandName: resolved.brokerBrandName,
  };
}

module.exports = {
  DEFAULT_PLATFORM_LOGO,
  getBrokerWhiteLabelBranding,
  resolveAgreementBranding,
  buildBrandingSnapshot,
  lockAgreementBranding,
};
