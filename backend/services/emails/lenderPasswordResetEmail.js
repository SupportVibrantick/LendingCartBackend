const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildLenderSignInUrl } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendLenderPasswordResetEmail({
  firstName,
  email,
  resetToken,
  prisma,
}) {
  const baseUrl = buildLenderSignInUrl().replace(/\/signin$/, "");
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const expiryHours = process.env.PASSWORD_RESET_EXPIRY_HOURS || "1";
  const name = firstName || "there";

  const html = loadTemplate("lender/passwordReset", {
    name,
    email,
    resetUrl,
    expiryHours,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Reset your lender portal password";
  const text = `Hi ${name},

We received a request to reset your lender portal password for ${email}.

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
    idempotencyKey: `lender-password-reset:${resetToken}`,
    provider: "SMTP",
  });
}

module.exports = { sendLenderPasswordResetEmail };
