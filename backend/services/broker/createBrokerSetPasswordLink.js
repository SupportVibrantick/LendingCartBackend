const crypto = require("crypto");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");

const RESET_TOKEN_EXPIRY_MS =
  Number(process.env.PASSWORD_RESET_EXPIRY_HOURS || 1) * 60 * 60 * 1000;

/**
 * Create a one-time set-password URL for an existing broker UserAccount.
 * Used by welcome email and post-checkout "Open broker dashboard" CTA.
 */
async function createBrokerSetPasswordLink(prisma, { email } = {}) {
  const resolvedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!resolvedEmail) {
    throw Object.assign(new Error("Broker email is required"), {
      statusCode: 400,
    });
  }

  const user = await prisma.userAccount.findFirst({
    where: { email: { equals: resolvedEmail, mode: "insensitive" } },
    select: { id: true, email: true, firstName: true },
  });

  if (!user) {
    throw Object.assign(new Error("Broker account not found"), {
      statusCode: 404,
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });
  });

  const { brokerDashboardUrl } = getEmailBranding();
  const baseUrl =
    buildBrokerSignInUrl().replace(/\/signin$/, "") || brokerDashboardUrl;
  const setPasswordUrl = `${String(baseUrl).replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    email: user.email,
    firstName: user.firstName || null,
    setPasswordUrl,
    signInUrl: buildBrokerSignInUrl(),
    expiresAt,
  };
}

module.exports = {
  createBrokerSetPasswordLink,
  RESET_TOKEN_EXPIRY_MS,
};
