const { loadTemplateAsync } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

function formatTrialAccessLabel(trialDays) {
  const n = Number(trialDays);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 90) return "3 months";
  if (n === 60) return "2 months";
  if (n === 30) return "1 month";
  if (n === 14) return "14 days";
  if (n === 7) return "7 days";
  return `${Math.floor(n)} days`;
}

function formatTrialEndsAtLabel(trialEndsAt) {
  if (!trialEndsAt) return null;
  const date = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function sendBrokerCredentialsEmail({
  adminFirstName,
  adminEmail,
  temporaryPassword,
  organizationName,
  packageName,
  prisma,
  idempotencyKey,
  trialDays = 0,
  trialEndsAt = null,
}) {
  const loginUrl = buildBrokerSignInUrl();
  const planLabel = packageName || "Selected Plan";
  const trialAccessLabel = formatTrialAccessLabel(trialDays);
  const isFreeTrial = Boolean(trialAccessLabel);
  const trialEndsAtLabel = formatTrialEndsAtLabel(trialEndsAt);
  const title = isFreeTrial
    ? `Your ${trialAccessLabel} free access is ready`
    : "Your broker account is ready";

  const { html, logoAttachment } = await loadTemplateAsync(
    "loanAi/brokerCredentials",
    {
      name: adminFirstName,
      organizationName,
      packageName: planLabel,
      adminEmail,
      temporaryPassword,
      loginUrl,
      currentYear: new Date().getFullYear(),
      title,
      isFreeTrial,
      trialAccessLabel,
      trialEndsAtLabel,
      trialDays: Number(trialDays) || 0,
    },
  );

  const subject = isFreeTrial
    ? `Your Loan Automation ${trialAccessLabel} free access — login details`
    : "Your Loan Automation broker dashboard login";

  const text = isFreeTrial
    ? `Hello ${adminFirstName},

Welcome to Loan Automation. Your Commercial Lending Mastery purchase includes ${trialAccessLabel} of full free access for ${organizationName}.

Access: ${trialAccessLabel} free (full features)
Plan during trial: ${planLabel}${
        trialEndsAtLabel ? `\nAccess through: ${trialEndsAtLabel}` : ""
      }
After that: Choose a paid plan in Loan Automation to keep using the dashboard.

Login email: ${adminEmail}
Temporary password: ${temporaryPassword}

Sign in at: ${loginUrl}

Please change your password after your first login. This password is only for the broker dashboard — it is separate from your Loan AI website login.

— Loan Automation`
    : `Hello ${adminFirstName},

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
    logoAttachment,
    idempotencyKey:
      idempotencyKey || `broker-credentials:${String(adminEmail).trim().toLowerCase()}`,
    provider: "SMTP",
  });
}

module.exports = {
  sendBrokerCredentialsEmail,
  formatTrialAccessLabel,
};
