const DEFAULT_PORTAL_LOGO = "/loanAutomation.jpeg";

async function resolveCoBrokerBranding(prisma, userId, brokerOrgId) {
  const [profile, whiteLabel] = await Promise.all([
    prisma.subBrokerProfile.findUnique({
      where: { userId },
      select: { logoUrl: true },
    }),
    brokerOrgId
      ? prisma.brokerWhiteLabelSetting.findFirst({
          where: { brokerOrgId },
          select: { logoUrl: true, brandName: true },
        })
      : Promise.resolve(null),
  ]);

  const logoUrl =
    profile?.logoUrl || whiteLabel?.logoUrl || DEFAULT_PORTAL_LOGO;

  return {
    logoUrl,
    brandName: whiteLabel?.brandName || null,
    portalLabel: "Co-Broker Portal",
    defaultLogoUrl: DEFAULT_PORTAL_LOGO,
  };
}

module.exports = {
  DEFAULT_PORTAL_LOGO,
  resolveCoBrokerBranding,
};
