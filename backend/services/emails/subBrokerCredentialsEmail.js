const { loadTemplate } = require("../../utils/email/loadTemplate");
const { getEmailBranding } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendSubBrokerCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
  prisma,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const loginUrl = `${brokerDashboardUrl}/sub-broker/login`;
  const name = firstName || "there";

  const html = loadTemplate("broker/subBrokerCredentials", {
    name,
    email,
    password,
    organizationName: organizationName || "your broker organization",
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your LendingCart sub broker account";
  const text = `Hi ${name},

You have been added as a sub broker for ${organizationName || "your broker organization"}.

Login email: ${email}
Password: ${password}

Sign in at: ${loginUrl}

Please change your password after your first login. Do not share these credentials.

— LendingCart`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `sub-broker-credentials:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendSubBrokerCredentialsEmail };
