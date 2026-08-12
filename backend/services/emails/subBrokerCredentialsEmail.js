const { loadTemplate } = require("../../utils/email/loadTemplate");
const { getEmailBranding } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");
const Handlebars = require("handlebars");

async function sendSubBrokerCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
  prisma,
  isPasswordReset = false,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const loginUrl = `${brokerDashboardUrl}/sub-broker/login`;
  const name = firstName || "there";

  const orgName = organizationName || "your broker organization";
  const title = isPasswordReset
    ? "Your sub broker password has been reset"
    : "Your sub broker account is ready";
  const intro = isPasswordReset
    ? `Your sub broker account password for <strong>${orgName}</strong> has been reset. Use the credentials below to sign in to the sub broker portal.`
    : `You have been added as a sub broker for <strong>${orgName}</strong>. Use the credentials below to sign in to the sub broker portal.`;
  const alert = isPasswordReset
    ? '<div class="alert"><strong>Didn’t request this?</strong> If you did not ask for a password reset, please contact your broker administrator immediately and avoid using the password above.</div>'
    : "";
  const footerNote = isPasswordReset
    ? "For your security, sign in and change this password to one only you know. Do not share these credentials."
    : "For security, change your password after your first login. Do not share these credentials.";

  const html = loadTemplate("broker/subBrokerCredentials", {
    title,
    intro: new Handlebars.SafeString(intro),
    alert: new Handlebars.SafeString(alert),
    ctaLabel: "Sign in to sub broker portal",
    name,
    email,
    password,
    organizationName: orgName,
    loginUrl,
    currentYear: new Date().getFullYear(),
    footerNote,
  });

  const subject = isPasswordReset
    ? "Your LendingCart sub broker password has been reset"
    : "Your LendingCart sub broker account";
  const greeting = isPasswordReset
    ? "Your sub broker account password has been reset."
    : "You have been added as a sub broker.";
  const footer = isPasswordReset
    ? "If you did not request this change, please contact your broker administrator immediately."
    : "Please change your password after your first login. Do not share these credentials.";

  const text = `Hi ${name},

${greeting}

Login email: ${email}
Password: ${password}

Sign in at: ${loginUrl}

${footer}

— LendingCart`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: isPasswordReset
      ? `sub-broker-password-reset:${email}:${Date.now()}`
      : `sub-broker-credentials:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendSubBrokerCredentialsEmail };