/**
 * Keep Organization.name and LenderBrandingSetting.brandName in sync.
 * Either field is treated as the public lender display name.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} lenderOrgId
 * @param {string} name
 * @returns {Promise<{ organization: object, branding: object }>}
 */
async function syncLenderCompanyAndBrandName(prisma, lenderOrgId, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    const err = new Error("Company / brand name is required");
    err.statusCode = 400;
    throw err;
  }

  const duplicateOrg = await prisma.organization.findFirst({
    where: {
      name: trimmed,
      id: { not: lenderOrgId },
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
      where: { id: lenderOrgId },
      data: { name: trimmed },
    }),
    prisma.lenderBrandingSetting.upsert({
      where: { lenderOrgId },
      update: {
        brandName: trimmed,
        updatedAt: new Date(),
      },
      create: {
        lenderOrgId,
        brandName: trimmed,
      },
    }),
  ]);

  return { organization, branding };
}

module.exports = {
  syncLenderCompanyAndBrandName,
};
