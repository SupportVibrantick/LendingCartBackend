const crypto = require("crypto");
const bcrypt = require("bcrypt");

/**
 * Resolve an active ClientPortalUser for broker/co-broker impersonation.
 * If the client has not set a password yet, provision (or restore) a portal
 * account with a random unusable hash so impersonation can proceed.
 *
 * Client self-login still requires set-password via invite link.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   clientId: string,
 *   contacts?: Array<{ email?: string | null, isPrimary?: boolean }>,
 * }} params
 */
async function ensureClientPortalUserForImpersonation(prisma, { clientId, contacts = [] }) {
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

  const email = primaryContact?.email
    ? String(primaryContact.email).trim().toLowerCase()
    : null;

  if (!email) {
    throw Object.assign(new Error("CLIENT_EMAIL_NOT_FOUND"), {
      statusCode: 400,
      clientMessage: "Borrower email is required to open the client portal",
    });
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

  const emailOwner = await prisma.clientPortalUser.findFirst({
    where: {
      OR: [
        { email },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (emailOwner && emailOwner.clientId !== clientId) {
    if (emailOwner.isDeleted) {
      return prisma.clientPortalUser.update({
        where: { id: emailOwner.id },
        data: {
          clientId,
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

  if (emailOwner && emailOwner.clientId === clientId) {
    return prisma.clientPortalUser.update({
      where: { id: emailOwner.id },
      data: {
        email,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  // Unusable password — client must still set password via invite for self-login.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

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
          OR: [{ clientId }, { email }, { email: { equals: email, mode: "insensitive" } }],
        },
        orderBy: { createdAt: "desc" },
      });
      if (raced && raced.clientId === clientId) {
        return prisma.clientPortalUser.update({
          where: { id: raced.id },
          data: {
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
