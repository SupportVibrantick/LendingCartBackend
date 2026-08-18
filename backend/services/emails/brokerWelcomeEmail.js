const crypto = require("crypto");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

const RESET_TOKEN_EXPIRY_MS =
  Number(process.env.PASSWORD_RESET_EXPIRY_HOURS || 1) * 60 * 60 * 1000;

async function sendBrokerWelcomeEmail({
  firstName,
  email,
  organizationName,
  packageName,
  prisma,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const baseUrl =
    buildBrokerSignInUrl().replace(/\/signin$/, "") || brokerDashboardUrl;

  // Generate password reset token for "set password" flow
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Create user with placeholder password hash (will be set via reset token)
  // Note: The user should already be created by the caller with a dummy password hash
  // We just need to create the reset token here
  const user = await prisma.userAccount.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Broker user not found for welcome email");
  }

  await prisma.$transaction(async (tx) => {
    // Invalidate any existing unused reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Create new reset token for "set password" flow
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
  });

  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const expiryHours = process.env.PASSWORD_RESET_EXPIRY_HOURS || "1";
  const name = firstName || "there";

  const html = loadTemplate("loanAi/brokerWelcome", {
    name,
    email,
    organizationName,
    packageName,
    setPasswordUrl: resetUrl,
    expiryHours,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Welcome to your LendingCart broker dashboard";
  const text = `Hi ${name},

Your broker account for ${organizationName} (${packageName} plan) is ready.

Set your password and sign in here (expires in ${expiryHours} hour(s)):
${resetUrl}

This link can only be used once. If you need a new link, use the "Forgot password" option on the sign-in page.

— LendingCart`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `broker-welcome:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerWelcomeEmail };