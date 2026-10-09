const Handlebars = require("handlebars");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildAdminSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

async function sendAdminCredentialsEmail({
  firstName,
  lastName,
  email,
  password,
  accessLevel,
  prisma,
}) {
  const { brandName } = getEmailBranding();
  const loginUrl = buildAdminSignInUrl();
  const name =
    [firstName, lastName].filter(Boolean).join(" ").trim() || firstName || "there";
  const accessLevelLabel =
    accessLevel === "FULL" ? "Full Access" : "Custom Access";

  const title = "Your platform admin account is ready";
  const intro = `You have been added as a platform administrator on <strong>${brandName}</strong>. Use the credentials below to sign in to the admin dashboard.`;
  const footerNote =
    "For security, change your password after your first login. Do not share these credentials.";

  const html = loadTemplate("admin/adminCredentials", {
    title,
    intro: new Handlebars.SafeString(intro),
    ctaLabel: "Sign in to admin dashboard",
    name,
    email,
    password,
    accessLevelLabel,
    loginUrl,
    currentYear: new Date().getFullYear(),
    footerNote,
  });

  const subject = `Your ${brandName} admin account`;
  const text = `Hi ${name},

You have been added as a platform administrator on ${brandName}.

Access level: ${accessLevelLabel}
Login email: ${email}
Password: ${password}

Sign in at: ${loginUrl}

Please change your password after your first login. Do not share these credentials.

— ${brandName}`;

  return enqueueEmail({
    prisma,
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `admin-credentials:${email}`,
    provider: "SMTP",
  });
}

module.exports = { sendAdminCredentialsEmail };
