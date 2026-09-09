const { loadTemplate } = require("../../utils/email/loadTemplate");
const { enqueueEmail } = require("../email");
const {
  buildAgencyLocationDashboardUrl,
  buildAgencyAppLoginUrl,
} = require("../ghl/ghlAccountLocation.service");

/**
 * Email GHL login credentials after Agency team-user create.
 * Never logs the password. Best-effort — caller should swallow failures.
 */
async function sendGhlAgencyUserCredentialsEmail({
  prisma,
  organizationId,
  userId,
  email,
  firstName,
  ghlLocationId,
  ghlUserId,
  tempPassword,
}) {
  if (!email || !tempPassword) return null;

  const dashboardUrl =
    buildAgencyLocationDashboardUrl(ghlLocationId) || buildAgencyAppLoginUrl();
  const loginUrl = buildAgencyAppLoginUrl();
  const name = firstName || "there";

  const html = loadTemplate("ghl/agencyUserCredentials", {
    name,
    email,
    temporaryPassword: tempPassword,
    loginUrl,
    dashboardUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your GoHighLevel CRM login is ready";
  const text = `Hi ${name},

Your CRM account is ready.

Login: ${loginUrl}
Email: ${email}
Temporary password: ${tempPassword}

Open your CRM dashboard:
${dashboardUrl}

Change this password after your first login. Do not share these credentials.

— Loan Automation`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `ghl-agency-user-credentials:${userId}:${ghlUserId}`,
    provider: "SMTP",
  });
}

module.exports = { sendGhlAgencyUserCredentialsEmail };
