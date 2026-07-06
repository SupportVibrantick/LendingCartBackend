const { loadTemplate } = require("../utils/loadTemplate");
const { buildLenderSignInUrl } = require("../utils/emailBranding");
const { enqueueEmail } = require("./email");
const { formatLenderRoleLabel } = require("../utils/lenderTeamRoles");

async function sendLenderTeamCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
  roleName,
  prisma,
}) {
  const loginUrl = buildLenderSignInUrl();
  const name = firstName || "there";
  const roleLabel = formatLenderRoleLabel(roleName);

  const html = loadTemplate("lender/teamMemberCredentials", {
    name,
    email,
    password,
    organizationName: organizationName || "your lender organization",
    roleLabel,
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your LendingCart lender portal invitation";
  const text = `Hi ${name},

You have been invited to join ${organizationName || "your lender organization"} on LendingCart as ${roleLabel}.

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
    idempotencyKey: `lender-team-credentials:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendLenderTeamCredentialsEmail };
