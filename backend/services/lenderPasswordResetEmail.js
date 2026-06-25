const { loadTemplate } = require("../utils/loadTemplate");
const { buildLenderSignInUrl } = require("../utils/emailBranding");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");

async function sendLenderPasswordResetEmail({
  firstName,
  email,
  resetToken,
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

  try {
    await sendMail({ to: email, subject, text, html });
    commonLogs.info("Lender password reset email sent via SMTP", { to: email });
    return;
  } catch (smtpErr) {
    commonLogs.warn("Lender password reset SMTP failed, trying Kafka", {
      to: email,
      error: smtpErr.message,
    });
  }

  try {
    await sendEmailUsingKafka(email, subject, text, html);
    commonLogs.info("Lender password reset email queued via Kafka", { to: email });
  } catch (kafkaErr) {
    commonLogs.error("Lender password reset email failed", {
      to: email,
      error: kafkaErr.message,
    });
    throw kafkaErr;
  }
}

module.exports = { sendLenderPasswordResetEmail };
