const DEFAULT_PORTAL_LOGO = "/loanAutomation.jpeg";

/**
 * Lightweight brand chrome for broker / loan-officer portals (logo + name only).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string|null|undefined} brokerOrgId
 * @param {string} portalLabel
 */
async function resolveBrokerPortalBranding(prisma, brokerOrgId, portalLabel) {
  if (!brokerOrgId) {
    return {
      logoUrl: DEFAULT_PORTAL_LOGO,
      brandName: null,
      portalLabel,
      defaultLogoUrl: DEFAULT_PORTAL_LOGO,
    };
  }

  const [whiteLabel, organization] = await Promise.all([
    prisma.brokerWhiteLabelSetting.findFirst({
      where: { brokerOrgId },
      select: { logoUrl: true, brandName: true },
    }),
    prisma.organization.findUnique({
      where: { id: brokerOrgId },
      select: { name: true },
    }),
  ]);

  return {
    logoUrl: whiteLabel?.logoUrl || DEFAULT_PORTAL_LOGO,
    brandName: whiteLabel?.brandName || organization?.name || null,
    portalLabel,
    defaultLogoUrl: DEFAULT_PORTAL_LOGO,
  };
}

module.exports = {
  DEFAULT_PORTAL_LOGO,
  resolveBrokerPortalBranding,
};
