async function getLenderBranding(prisma, lenderOrgId) {
  if (!lenderOrgId) {
    return {
      lenderLogoUrl: null,
      lenderBrandName: null,
    };
  }

  const settings = await prisma.lenderBrandingSetting.findFirst({
    where: { lenderOrgId },
    select: {
      logoUrl: true,
      brandName: true,
    },
  });

  return {
    lenderLogoUrl: settings?.logoUrl || null,
    lenderBrandName: settings?.brandName || null,
  };
}

module.exports = {
  getLenderBranding,
};
