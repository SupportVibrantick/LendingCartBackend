const { loadTemplate } = require("../utils/loadTemplate");
const { buildBrokerSignInUrl } = require("../utils/emailBranding");
const { buildBrokerWelcomeEmailData } = require("../utils/emailTemplateData");
const sendMail = require("./mail");
const { sendEmailUsingKafka } = require("./kafka/email/producer");
const { commonLogs } = require("./logger/contextLogger");

async function sendBrokerWelcomeEmail({
  adminFirstName,
  adminLastName,
  adminEmail,
  organizationName,
  organizationEmail,
  organizationPhone,
}) {
  const loginUrl = buildBrokerSignInUrl();

  const html = loadTemplate(
    "admin/broker/create",
    buildBrokerWelcomeEmailData({
      name: adminFirstName,
      organizationName,
      organizationEmail,
      organizationPhone,
      adminEmail,
      loginUrl: buildBrokerSignInUrl(),
    }),
  );

  const subject = "Welcome to LendingCart — Your broker account is ready";
  const text = `Hello ${adminFirstName}, your broker account for ${organizationName} is ready. Sign in at ${loginUrl} with your email (${adminEmail}) and the password you chose during registration.`;

  try {
    await sendEmailUsingKafka(adminEmail, subject, text, html);
  } catch (kafkaErr) {
    commonLogs.warn("Broker welcome email Kafka failed, using SMTP", {
      to: adminEmail,
      error: kafkaErr.message,
    });
    await sendMail({ to: adminEmail, subject, text, html });
  }
}

module.exports = { sendBrokerWelcomeEmail };
