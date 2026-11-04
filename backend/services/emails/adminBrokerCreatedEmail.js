const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const { buildBrokerWelcomeEmailData } = require("../../utils/email/emailTemplateData");
const { enqueueAndFlushEmail } = require("../email");

async function sendAdminBrokerCreatedEmail({
  prisma,
  adminFirstName,
  adminEmail,
  adminPassword,
  organizationName,
  organizationEmail,
  organizationPhone,
  organizationId,
}) {
  const loginUrl = buildBrokerSignInUrl();
  const branding = getEmailBranding();
  const name = adminFirstName || "there";

  const html = loadTemplate(
    "admin/broker/create",
    buildBrokerWelcomeEmailData({
      name,
      organizationName,
      organizationEmail,
      organizationPhone,
      adminEmail,
      temporaryPassword: adminPassword,
      loginUrl,
      currentYear: new Date().getFullYear(),
      logoUrl: branding.logoUrl,
      brandName: branding.brandName,
    }),
  );

  const subject = "Your Loan Automation broker account is ready";
  const text = `Hi ${name},

Your broker organization "${organizationName}" has been created on Loan Automation.

Login email: ${adminEmail}
Password: ${adminPassword}

Sign in at: ${loginUrl}

Please change your password after your first login. Do not share these credentials.

— Loan Automation`;

  return enqueueAndFlushEmail({
    prisma,
    to: adminEmail,
    subject,
    text,
    html,
    idempotencyKey: organizationId
      ? `admin-broker-create:${organizationId}`
      : `admin-broker-create:${String(adminEmail).trim().toLowerCase()}:${Date.now()}`,
    provider: "SMTP",
  });
}

module.exports = { sendAdminBrokerCreatedEmail };
