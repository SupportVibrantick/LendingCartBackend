const { loadTemplate } = require("../utils/loadTemplate");
const { buildLenderSignInUrl } = require("../utils/emailBranding");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");
const { formatLenderRoleLabel } = require("../utils/lenderTeamRoles");

async function sendLenderTeamCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
  roleName,
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

  let smtpError = null;

  try {
    await sendMail({ to: email, subject, text, html });
    commonLogs.info("Lender team invitation email sent via SMTP", { to: email });
    return;
  } catch (error) {
    smtpError = error;
    commonLogs.warn("Lender team invitation SMTP failed, trying Kafka", {
      to: email,
      error: error.message,
    });
  }

  try {
    await sendEmailUsingKafka(email, subject, text, html);
    commonLogs.info("Lender team invitation email queued via Kafka", {
      to: email,
    });
    return;
  } catch (kafkaErr) {
    commonLogs.error("Lender team invitation email failed on SMTP and Kafka", {
      to: email,
      smtpError: smtpError?.message,
      kafkaError: kafkaErr.message,
    });

    const error = new Error(
      "Failed to send invitation email. Check SMTP configuration.",
    );
    error.code = "EMAIL_SEND_FAILED";
    throw error;
  }
}

module.exports = { sendLenderTeamCredentialsEmail };
