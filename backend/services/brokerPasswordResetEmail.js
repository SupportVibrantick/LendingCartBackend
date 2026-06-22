const { loadTemplate } = require("../utils/loadTemplate");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../utils/emailBranding");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");

async function sendBrokerPasswordResetEmail({
  firstName,
  email,
  resetToken,
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

  try {
    await sendEmailUsingKafka(email, subject, text, html);
  } catch (kafkaErr) {
    commonLogs.warn("Broker password reset email Kafka failed, using SMTP", {
      to: email,
      error: kafkaErr.message,
    });
    await sendMail({ to: email, subject, text, html });
  }
}

module.exports = { sendBrokerPasswordResetEmail };
