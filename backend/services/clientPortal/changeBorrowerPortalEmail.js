const {
  normalizeClientEmail,
} = require("./findOrCreateBorrowerClient");

/**
 * Change the primary client-portal login email for a loan application's client.
 * Keeps the same Client / portal account; previous email can no longer log in.
 */
async function changeBorrowerPortalEmail(
  prisma,
  {
    brokerOrgId,
    loanApplicationId,
    newEmail,
    previousEmail,
  },
) {
  const normalizedNew = normalizeClientEmail(newEmail);
  const normalizedPrevious = normalizeClientEmail(previousEmail);

  if (!normalizedNew) {
    const err = new Error("New email is required");
    err.statusCode = 400;
    throw err;
  }
  if (!brokerOrgId || !loanApplicationId) {
    const err = new Error("Application not found");
    err.statusCode = 404;
    throw err;
  }
  if (normalizedPrevious && normalizedPrevious === normalizedNew) {
    return {
      changed: false,
      reason: "unchanged",
      email: normalizedNew,
    };
  }

  const application = await prisma.loanApplication.findFirst({
    where: {
      id: loanApplicationId,
      brokerOrgId,
    },
    include: {
      client: {
        include: {
          contacts: true,
          portalUsers: {
            where: { isDeleted: { not: true } },
            orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
          },
        },
      },
    },
  });

  if (!application?.client) {
    const err = new Error("Application client not found");
    err.statusCode = 404;
    throw err;
  }

  const client = application.client;

  const conflict = await prisma.clientPortalUser.findFirst({
    where: {
      isDeleted: { not: true },
      clientId: { not: client.id },
      OR: [
        { email: normalizedNew },
        { email: { equals: normalizedNew, mode: "insensitive" } },
      ],
    },
    select: { id: true, clientId: true, email: true },
  });

  if (conflict) {
    const err = new Error(
      "This email is already used by another client portal account",
    );
    err.statusCode = 409;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    const contacts = client.contacts || [];
    const matchingContacts = contacts.filter((contact) => {
      const email = normalizeClientEmail(contact.email);
      if (normalizedPrevious && email === normalizedPrevious) return true;
      if (contact.isPrimary) return true;
      return false;
    });

    const contactsToUpdate =
      matchingContacts.length > 0
        ? matchingContacts
        : contacts[0]
          ? [contacts[0]]
          : [];

    for (const contact of contactsToUpdate) {
      await tx.clientContact.update({
        where: { id: contact.id },
        data: { email: normalizedNew },
      });
    }

    if (contactsToUpdate.length === 0) {
      await tx.clientContact.create({
        data: {
          clientId: client.id,
          firstName: client.legalName?.split(/\s+/)[0] || "Applicant",
          lastName: null,
          email: normalizedNew,
          isPrimary: true,
        },
      });
    }

    const portalUsers = client.portalUsers || [];
    let activePortalUser =
      portalUsers.find(
        (user) =>
          normalizeClientEmail(user.email) === normalizedPrevious &&
          user.isActive !== false,
      ) ||
      portalUsers.find((user) => user.isActive !== false) ||
      portalUsers[0] ||
      null;

    // Soft-deactivate any other portal logins on this client that still use
    // the previous email (or are inactive duplicates).
    for (const user of portalUsers) {
      if (activePortalUser && user.id === activePortalUser.id) continue;
      const email = normalizeClientEmail(user.email);
      if (
        (normalizedPrevious && email === normalizedPrevious) ||
        email === normalizedNew
      ) {
        await tx.clientPortalUser.update({
          where: { id: user.id },
          data: {
            isActive: false,
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      }
    }

    if (activePortalUser) {
      // Same portal account: swap login email in place.
      await tx.clientPortalUser.update({
        where: { id: activePortalUser.id },
        data: {
          email: normalizedNew,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
      });

      await tx.clientPortalPasswordResetToken.updateMany({
        where: {
          userId: activePortalUser.id,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
    }

    return {
      changed: true,
      clientId: client.id,
      previousEmail: normalizedPrevious || null,
      email: normalizedNew,
      portalUserUpdated: Boolean(activePortalUser),
    };
  });

  return result;
}

module.exports = {
  changeBorrowerPortalEmail,
};
