const { loadTemplate } = require("../utils/loadTemplate");
const { getEmailBranding } = require("../utils/emailBranding");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");

async function sendSubBrokerCredentialsEmail({
  firstName,
  email,
  password,
  organizationName,
}) {
  const { brokerDashboardUrl } = getEmailBranding();
  const loginUrl = `${brokerDashboardUrl}/sub-broker/login`;
  const name = firstName || "there";

  const html = loadTemplate("broker/subBrokerCredentials", {
    name,
    email,
    password,
    organizationName: organizationName || "your broker organization",
    loginUrl,
    currentYear: new Date().getFullYear(),
  });

  const subject = "Your LendingCart sub broker account";
  const text = `Hi ${name},

You have been added as a sub broker for ${organizationName || "your broker organization"}.

Login email: ${email}
Password: ${password}

Sign in at: ${loginUrl}

Please change your password after your first login. Do not share these credentials.

— LendingCart`;

  try {
    await sendEmailUsingKafka(email, subject, text, html);
  } catch (kafkaErr) {
    commonLogs.warn("Sub broker credentials email Kafka failed, using SMTP", {
      to: email,
      error: kafkaErr.message,
    });
    await sendMail({ to: email, subject, text, html });
  }
}

module.exports = { sendSubBrokerCredentialsEmail };
