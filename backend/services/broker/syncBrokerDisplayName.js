/**
 * Keep Organization.name and BrokerWhiteLabelSetting.brandName in sync.
 * Optionally also updates BrokerUserProfile.company for a specific user.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} brokerOrgId
 * @param {string} name
 * @param {{ userId?: string }} [options]
 * @returns {Promise<{ organization: object, branding: object }>}
 */
async function syncBrokerCompanyAndBrandName(
  prisma,
  brokerOrgId,
  name,
  options = {},
) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    const err = new Error("Company / brand name is required");
    err.statusCode = 400;
    throw err;
  }

  const duplicateOrg = await prisma.organization.findFirst({
    where: {
      name: trimmed,
      id: { not: brokerOrgId },
      isDeleted: false,
    },
  });

  if (duplicateOrg) {
    const err = new Error(
      "Another organization already uses this company name",
    );
    err.statusCode = 409;
    throw err;
  }

  const [organization, branding] = await prisma.$transaction([
    prisma.organization.update({
      where: { id: brokerOrgId },
      data: { name: trimmed },
    }),
    prisma.brokerWhiteLabelSetting.upsert({
      where: { brokerOrgId },
      update: {
        brandName: trimmed,
        updatedAt: new Date(),
      },
      create: {
        brokerOrgId,
        brandName: trimmed,
        domainVerified: false,
        sslStatus: "PENDING",
      },
    }),
  ]);

  if (options.userId) {
    await prisma.brokerUserProfile.upsert({
      where: { userId: options.userId },
      update: { company: trimmed },
      create: { userId: options.userId, company: trimmed },
    });
  }

  return { organization, branding };
}

module.exports = {
  syncBrokerCompanyAndBrandName,
};
