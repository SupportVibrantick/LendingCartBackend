const { loadTemplate } = require("../utils/loadTemplate");
const { buildBrokerSignInUrl } = require("../utils/emailBranding");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");

async function sendBrokerCredentialsEmail({
  adminFirstName,
  adminEmail,
  temporaryPassword,
  organizationName,
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

  try {
    await sendEmailUsingKafka(adminEmail, subject, text, html);
  } catch (kafkaErr) {
    commonLogs.warn("Broker credentials email Kafka failed, using SMTP", {
      to: adminEmail,
      error: kafkaErr.message,
    });
    await sendMail({ to: adminEmail, subject, text, html });
  }
}

module.exports = { sendBrokerCredentialsEmail };
