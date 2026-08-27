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
  adminFirstName,
  adminEmail,
  organizationName,
  packageName,
  prisma,
  idempotencyKey,
}) {
  const resolvedEmail = String(email || adminEmail || "")
    .trim()
    .toLowerCase();
  const resolvedFirstName = firstName || adminFirstName || "there";

  if (!resolvedEmail) {
    throw new Error("Broker email is required for welcome email");
  }

  const { brokerDashboardUrl } = getEmailBranding();
  const baseUrl =
    buildBrokerSignInUrl().replace(/\/signin$/, "") || brokerDashboardUrl;

  // Generate password reset token for "set password" flow
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  const user = await prisma.userAccount.findFirst({
    where: { email: { equals: resolvedEmail, mode: "insensitive" } },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Broker user not found for welcome email");
  }

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

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
  const name = resolvedFirstName;

  const html = loadTemplate("loanAi/brokerWelcome", {
    name,
    email: resolvedEmail,
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
    to: resolvedEmail,
    subject,
    text,
    html,
    idempotencyKey: idempotencyKey || `broker-welcome:${resolvedEmail}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerWelcomeEmail };