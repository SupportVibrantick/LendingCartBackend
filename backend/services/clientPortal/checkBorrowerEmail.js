const {
  findExistingBorrowerClient,
  normalizeClientEmail,
} = require("./findOrCreateBorrowerClient");

/**
 * Check whether a borrower email already maps to a Client / Client Portal
 * within this broker org (used before NEW loan application submit).
 */
async function checkBorrowerEmail(prisma, { brokerOrgId, email }) {
  const normalizedEmail = normalizeClientEmail(email);
  if (!normalizedEmail) {
    const err = new Error("Email is required");
    err.statusCode = 400;
    throw err;
  }
  if (!brokerOrgId) {
    const err = new Error("brokerOrgId is required");
    err.statusCode = 400;
    throw err;
  }

  const client = await findExistingBorrowerClient(prisma, {
    brokerOrgId,
    email: normalizedEmail,
  });

  if (!client) {
    return {
      exists: false,
      email: normalizedEmail,
      clientId: null,
      clientName: null,
      hasPortalUser: false,
      applicationCount: 0,
    };
  }

  const [portalUser, applicationCount] = await Promise.all([
    prisma.clientPortalUser.findFirst({
      where: {
        clientId: client.id,
        isDeleted: { not: true },
        OR: [
          { email: normalizedEmail },
          { email: { equals: normalizedEmail, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, isActive: true },
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.loanApplication.count({
      where: {
        clientId: client.id,
        brokerOrgId,
      },
    }),
  ]);

  const primaryContact =
    (client.contacts || []).find((c) => c.isPrimary) ||
    (client.contacts || [])[0] ||
    null;
  const clientName =
    [primaryContact?.firstName, primaryContact?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    client.legalName ||
    null;

  return {
    exists: true,
    email: normalizedEmail,
    clientId: client.id,
    clientName,
    hasPortalUser: Boolean(portalUser?.id),
    applicationCount,
  };
}

module.exports = {
  checkBorrowerEmail,
};
