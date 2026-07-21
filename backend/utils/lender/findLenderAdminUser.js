/**
 * Resolve the primary LENDER_ADMIN user for a lender organization.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} lenderOrgId
 */
async function findLenderAdminUser(prisma, lenderOrgId) {
  const adminUserRole = await prisma.userRole.findFirst({
    where: {
      role: { name: "LENDER_ADMIN" },
      user: {
        organizationId: lenderOrgId,
        isDeleted: { not: true },
      },
    },
    include: { user: true },
    orderBy: { user: { createdAt: "asc" } },
  });

  return adminUserRole?.user ?? null;
}

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

module.exports = {
  findLenderAdminUser,
  normalizeEmail,
};
