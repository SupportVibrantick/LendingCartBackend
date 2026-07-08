const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { buildBrokerWelcomeEmailData } = require("../../utils/email/emailTemplateData");
const { enqueueEmail } = require("../email");

async function sendBrokerWelcomeEmail({
  adminFirstName,
  adminEmail,
  organizationName,
  organizationEmail,
  organizationPhone,
  prisma,
}) {
  const loginUrl = buildBrokerSignInUrl();

  const html = loadTemplate(
    "admin/broker/create",
    buildBrokerWelcomeEmailData({
      name: adminFirstName,
      organizationName,
      organizationEmail,
      organizationPhone,
      adminEmail,
      loginUrl,
    }),
  );

  const subject = "Welcome to LendingCart — Your broker account is ready";
  const text = `Hello ${adminFirstName}, your broker account for ${organizationName} is ready. Sign in at ${loginUrl} with your email (${adminEmail}) and the password you chose during registration.`;

  return enqueueEmail({
    prisma,
    to: adminEmail,
    subject,
    text,
    html,
    idempotencyKey: `broker-welcome:${adminEmail}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerWelcomeEmail };
