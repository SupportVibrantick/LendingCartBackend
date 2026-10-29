const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildClientPortalUrl,
  getEmailBranding,
  stripTrailingSlash,
  ensureAbsoluteUrl,
} = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

function buildClientPortalResetUrl(resetToken) {
  const { frontendUrl } = getEmailBranding();
  const base = stripTrailingSlash(frontendUrl || buildClientPortalUrl());
  if (!base || !resetToken) return "";
  return ensureAbsoluteUrl(
    `${base}/client-upload?resetToken=${encodeURIComponent(resetToken)}`,
  );
}

async function sendClientPortalPasswordResetEmail({
  firstName,
  email,
  resetToken,
  prisma,
}) {
  const resetUrl = buildClientPortalResetUrl(resetToken);
  const expiryHours = process.env.PASSWORD_RESET_EXPIRY_HOURS || "1";
  const name = firstName || "there";

  const html = loadTemplate("clientPortal/passwordReset", {
    name,
    email,
    resetUrl,
    expiryHours,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Reset your client portal password";
  const text = `Hi ${name},

We received a request to reset your client portal password for ${email}.

Reset your password here (expires in ${expiryHours} hour(s)):
${resetUrl}

If you did not request this, you can ignore this email.

— Loan Automation`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `client-portal-password-reset:${resetToken}`,
    provider: "SMTP",
  });
}

module.exports = {
  sendClientPortalPasswordResetEmail,
  buildClientPortalResetUrl,
};
