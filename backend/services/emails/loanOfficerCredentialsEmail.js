const { loadTemplate } = require("../../utils/email/loadTemplate");
const { getEmailBranding } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendLoanOfficerCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
  prisma,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const loginUrl = `${brokerDashboardUrl}/loan-officer/login`;
  const name = firstName || "there";

  const html = loadTemplate("broker/loanOfficerCredentials", {
    name,
    email,
    password,
    organizationName: organizationName || "your broker organization",
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your LendingCart loan officer account";
  const text = `Hi ${name},

You have been added as a loan officer for ${organizationName || "your broker organization"}.

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
    idempotencyKey: `loan-officer-credentials:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendLoanOfficerCredentialsEmail };
