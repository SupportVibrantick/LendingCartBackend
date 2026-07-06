const { loadTemplate } = require("../utils/loadTemplate");
const { buildBrokerSignInUrl } = require("../utils/emailBranding");
const { enqueueEmail } = require("./email");

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

  const subject = "Your LendingCart broker dashboard credentials";
  const text = `Hello ${adminFirstName},

Your broker account for ${organizationName} is ready.

Login email: ${adminEmail}
Temporary password: ${temporaryPassword}

Sign in at: ${loginUrl}

Please change your password after your first login. This password is only for the broker dashboard — it is separate from your Loan AI website login.

— LendingCart`;

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
