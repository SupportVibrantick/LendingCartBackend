const crypto = require("crypto");
const bcrypt = require("bcrypt");
const {
  normalizeClientEmail,
} = require("./findOrCreateBorrowerClient");

/**
 * Resolve an active ClientPortalUser for broker/co-broker impersonation.
 * If the client has not set a password yet, provision (or restore) a portal
 * account with a random unusable hash so impersonation can proceed.
 *
 * Client self-login still requires set-password via invite link.
 *
 * Email uniqueness is preserved: if another ClientPortalUser already owns the
 * borrower email, that portal user is reused. clientId is never reassigned.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   clientId: string,
 *   contacts?: Array<{ email?: string | null, isPrimary?: boolean }>,
 * }} params
 */
async function ensureClientPortalUserForImpersonation(
  prisma,
  { clientId, contacts = [] },
) {
  const existingActive = await prisma.clientPortalUser.findFirst({
    where: {
      clientId,
      isDeleted: false,
      isActive: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
  });
  if (existingActive) return existingActive;

  const primaryContact =
    contacts.find((c) => c.isPrimary && c.email) ||
    contacts.find((c) => c.email) ||
    (await prisma.clientContact.findFirst({
      where: { clientId },
      orderBy: { isPrimary: "desc" },
      select: { email: true, isPrimary: true },
    }));

  const email = normalizeClientEmail(primaryContact?.email);

  if (!email) {
    throw Object.assign(new Error("CLIENT_EMAIL_NOT_FOUND"), {
      statusCode: 400,
      clientMessage: "Borrower email is required to open the client portal",
    });
  }

  // Prefer existing portal identity for this email (any clientId).
  const emailOwner = await prisma.clientPortalUser.findFirst({
    where: {
      OR: [
        { email },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
  });

  if (emailOwner) {
    if (emailOwner.isDeleted || !emailOwner.isActive) {
      return prisma.clientPortalUser.update({
        where: { id: emailOwner.id },
        data: {
          // Preserve original clientId — do not reassign on impersonation.
          email,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
      });
    }
    return emailOwner;
  }

  const anyForClient = await prisma.clientPortalUser.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  if (anyForClient) {
    return prisma.clientPortalUser.update({
      where: { id: anyForClient.id },
      data: {
        email,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  // Unusable password — client must still set password via invite for self-login.
  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    10,
  );

  try {
    return await prisma.clientPortalUser.create({
      data: {
        clientId,
        email,
        passwordHash,
        isActive: true,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const raced = await prisma.clientPortalUser.findFirst({
        where: {
          OR: [
            { email },
            { email: { equals: email, mode: "insensitive" } },
            { clientId },
          ],
        },
        orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
      });
      if (raced) {
        return prisma.clientPortalUser.update({
          where: { id: raced.id },
          data: {
            // Keep raced.clientId; only reactivate + normalize email.
            email,
            isActive: true,
            isDeleted: false,
            deletedAt: null,
          },
        });
      }
      throw Object.assign(new Error("PORTAL_EMAIL_IN_USE"), {
        statusCode: 409,
        clientMessage:
          "This borrower email is already linked to another client portal account",
      });
    }
    throw err;
  }
}

module.exports = {
  ensureClientPortalUserForImpersonation,
};
