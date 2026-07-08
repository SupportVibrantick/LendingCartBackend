const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendBrokerPasswordResetEmail({
  firstName,
  email,
  resetToken,
  prisma,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const baseUrl =
    buildBrokerSignInUrl().replace(/\/signin$/, "") || brokerDashboardUrl;
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const expiryHours = process.env.PASSWORD_RESET_EXPIRY_HOURS || "1";
  const name = firstName || "there";

  const html = loadTemplate("broker/passwordReset", {
    name,
    email,
    resetUrl,
    expiryHours,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Reset your broker dashboard password";
  const text = `Hi ${name},

We received a request to reset your broker dashboard password for ${email}.

Reset your password here (expires in ${expiryHours} hour(s)):
${resetUrl}

If you did not request this, you can ignore this email.

— LendingCart`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `broker-password-reset:${resetToken}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerPasswordResetEmail };
