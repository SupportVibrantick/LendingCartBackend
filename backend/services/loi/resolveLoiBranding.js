const { getLenderBranding } = require("../lender/lenderBranding");
const {
  getBrokerWhiteLabelBranding,
} = require("../broker/brokerBranding");

function normalizeBrandingInput(branding) {
  if (!branding || typeof branding !== "object") {
    return null;
  }

  const brandName = String(branding.brandName || "").trim();
  const logoUrl = String(branding.logoUrl || "").trim();

  if (!brandName && !logoUrl) {
    return null;
  }

  return { brandName, logoUrl };
}

async function persistLenderLoiBranding(prisma, lenderOrgId, branding) {
  const normalized = normalizeBrandingInput(branding);
  if (!normalized?.brandName || !normalized.logoUrl) {
    throw new Error(
      "Brand name and logo are required for LOI / term sheet generation.",
    );
  }

  await prisma.lenderBrandingSetting.upsert({
    where: { lenderOrgId },
    update: {
      brandName: normalized.brandName,
      logoUrl: normalized.logoUrl,
      updatedAt: new Date(),
    },
    create: {
      lenderOrgId,
      brandName: normalized.brandName,
      logoUrl: normalized.logoUrl,
    },
  });

  return {
    lenderBrandName: normalized.brandName,
    lenderLogoUrl: normalized.logoUrl,
  };
}

async function resolveLenderLoiBranding(
  prisma,
  lenderOrgId,
  requestBranding,
  fallbackOrgName = "Lender",
) {
  const normalized = normalizeBrandingInput(requestBranding);
  if (normalized) {
    return persistLenderLoiBranding(prisma, lenderOrgId, normalized);
  }

  const saved = await getLenderBranding(prisma, lenderOrgId);
  if (saved.lenderBrandName?.trim() && saved.lenderLogoUrl) {
    return saved;
  }

  return {
    lenderBrandName: saved.lenderBrandName?.trim() || fallbackOrgName,
    lenderLogoUrl: saved.lenderLogoUrl || null,
  };
}

async function persistBrokerLoiBranding(prisma, brokerOrgId, branding) {
  const normalized = normalizeBrandingInput(branding);
  if (!normalized?.brandName || !normalized.logoUrl) {
    throw new Error(
      "Brand name and logo are required for broker LOI / term sheet generation.",
    );
  }

  await prisma.brokerWhiteLabelSetting.upsert({
    where: { brokerOrgId },
    update: {
      brandName: normalized.brandName,
      logoUrl: normalized.logoUrl,
      updatedAt: new Date(),
    },
    create: {
      brokerOrgId,
      brandName: normalized.brandName,
      logoUrl: normalized.logoUrl,
      domainVerified: false,
      sslStatus: "PENDING",
    },
  });

  return {
    brokerBrandName: normalized.brandName,
    brokerLogoUrl: normalized.logoUrl,
  };
}

async function resolveBrokerLoiBranding(prisma, brokerOrgId, requestBranding) {
  const normalized = normalizeBrandingInput(requestBranding);
  if (normalized) {
    return persistBrokerLoiBranding(prisma, brokerOrgId, normalized);
  }

  const saved = await getBrokerWhiteLabelBranding(prisma, brokerOrgId);
  if (!saved.brokerBrandName?.trim() || !saved.brokerLogoUrl) {
    throw new Error(
      "Broker branding is incomplete. Add brand name and logo before generating a broker LOI.",
    );
  }

  return saved;
}

module.exports = {
  normalizeBrandingInput,
  persistLenderLoiBranding,
  resolveLenderLoiBranding,
  persistBrokerLoiBranding,
  resolveBrokerLoiBranding,
};
