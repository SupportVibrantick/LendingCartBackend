/**
 * Count active lender admins in an organization.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} organizationId
 * @param {{ excludeUserId?: string }} [options]
 */
async function countActiveLenderAdmins(prisma, organizationId, options = {}) {
  const { excludeUserId } = options;
  return prisma.userAccount.count({
    where: {
      organizationId,
      isDeleted: false,
      status: "ACTIVE",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      roles: {
        some: { role: { name: "LENDER_ADMIN" } },
      },
    },
  });
}

module.exports = {
  countActiveLenderAdmins,
};
