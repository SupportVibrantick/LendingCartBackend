const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendBrokerCredentialsEmail({
  adminFirstName,
  adminEmail,
  temporaryPassword,
  organizationName,
  packageName,
  prisma,
  idempotencyKey,
}) {
  const loginUrl = buildBrokerSignInUrl();
  const planLabel = packageName || "Selected Plan";

  const html = loadTemplate("loanAi/brokerCredentials", {
    name: adminFirstName,
    organizationName,
    packageName: planLabel,
    adminEmail,
    temporaryPassword,
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your Loan Automation broker dashboard login";
  const text = `Hello ${adminFirstName},

Payment for ${organizationName} was successful (${planLabel} plan). Your broker dashboard login is ready.

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
    idempotencyKey:
      idempotencyKey || `broker-credentials:${String(adminEmail).trim().toLowerCase()}`,
    provider: "SMTP",
  });
}

module.exports = { sendBrokerCredentialsEmail };
