const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendBrokerCredentialsEmail({
  adminFirstName,
  adminEmail,
  temporaryPassword,
  organizationName,
  prisma,
}) {
  const loginUrl = buildBrokerSignInUrl();

  const html = loadTemplate("loanAi/brokerCredentials", {
    name: adminFirstName,
    organizationName,
    adminEmail,
    temporaryPassword,
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your Loan Automation broker dashboard credentials";
  const text = `Hello ${adminFirstName},

Your broker account for ${organizationName} is ready.

Login email: ${adminEmail}
Temporary password: ${temporaryPassword}

Sign in at: ${loginUrl}

Please change your password after your first login. This password is only for the broker dashboard — it is separate from your Loan AI website login.

— Loan Automation`;

  return enqueueEmail({
    prisma,
    to: adminEmail,
    subject,
    text,
    html,
    idempotencyKey: `broker-credentials:${adminEmail}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerCredentialsEmail };
