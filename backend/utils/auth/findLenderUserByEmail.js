const { LENDER_PORTAL_ROLES } = require("../lender/lenderTeamRoles");

/**
 * Find an active lender-portal user by email (case-insensitive).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} email
 */
async function findLenderUserByEmail(prisma, email) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.userAccount.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
      isDeleted: { not: true },
    },
    include: {
      organization: true,
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) return null;

  if (user.status !== "ACTIVE") return null;

  if (
    !user.organization ||
    user.organization.type !== "LENDER" ||
    user.organization.status !== "ACTIVE"
  ) {
    return null;
  }

  const roles = user.roles.map((entry) => entry.role.name);
  const hasAccess = roles.some((role) => LENDER_PORTAL_ROLES.includes(role));

  if (!hasAccess) return null;

  return user;
}

module.exports = {
  findLenderUserByEmail,
};
