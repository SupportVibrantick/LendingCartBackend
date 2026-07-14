const crypto = require("crypto");

const INVITE_TTL_DAYS = Number(process.env.ADMIN_LENDER_INVITE_TTL_DAYS || 7);

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildInviteExpiry(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  return expiresAt;
}

function splitFullName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Lender", lastName: "Admin" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Mark PENDING invites past expiresAt as EXPIRED.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string[]} [ids]
 */
async function expireStaleInvites(prisma, ids) {
  const where = {
    status: "PENDING",
    expiresAt: { lt: new Date() },
  };
  if (Array.isArray(ids) && ids.length > 0) {
    where.id = { in: ids };
  }

  await prisma.adminLenderInvite.updateMany({
    where,
    data: { status: "EXPIRED" },
  });
}

/**
 * Resolve invite by token with fresh expiry check.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} token
 */
async function findInviteByToken(prisma, token) {
  const invite = await prisma.adminLenderInvite.findUnique({
    where: { token: String(token || "").trim() },
  });

  if (!invite) return null;

  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    return prisma.adminLenderInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
  }

  return invite;
}

function mapInviteForAdmin(invite) {
  return {
    id: invite.id,
    companyName: invite.companyName,
    fullName: invite.fullName,
    email: invite.email,
    phone: invite.phone,
    status: invite.status,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    declinedAt: invite.declinedAt,
    cancelledAt: invite.cancelledAt,
    lastSentAt: invite.lastSentAt,
    createdAt: invite.createdAt,
    lenderOrgId: invite.lenderOrgId,
  };
}

module.exports = {
  INVITE_TTL_DAYS,
  generateInviteToken,
  buildInviteExpiry,
  splitFullName,
  expireStaleInvites,
  findInviteByToken,
  mapInviteForAdmin,
};
