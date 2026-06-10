const BROKER_DASHBOARD_ROLES = ["BROKER_ADMIN", "BROKER_OFFICER", "SUB_BROKER"];

/**
 * Find an active broker-dashboard user by email (case-insensitive).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} email
 */
async function findBrokerUserByEmail(prisma, email) {
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
    user.organization.type !== "BROKER" ||
    user.organization.status !== "ACTIVE"
  ) {
    return null;
  }

  const roles = user.roles.map((r) => r.role.name);
  const hasAccess = roles.some((role) => BROKER_DASHBOARD_ROLES.includes(role));

  if (!hasAccess) return null;

  return user;
}

module.exports = {
  findBrokerUserByEmail,
  BROKER_DASHBOARD_ROLES,
};
