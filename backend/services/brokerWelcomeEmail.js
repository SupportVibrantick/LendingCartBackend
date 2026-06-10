const { loadTemplate } = require("../utils/loadTemplate");
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
  const apiBase = process.env.VITE_API_BASE || process.env.APP_URL || "";
  const brokerDashboardUrl =
    process.env.VITE_BROKER_DASHBOARD_URL || process.env.BROKER_DASHBOARD_URL || apiBase;

  const loginUrl = brokerDashboardUrl.includes("/signin")
    ? brokerDashboardUrl
    : `${brokerDashboardUrl.replace(/\/$/, "")}/signin`;

  const html = loadTemplate("admin/broker/create", {
    name: adminFirstName,
    currentYear: new Date().getFullYear(),
    organizationName,
    organizationEmail,
    organizationPhone,
    adminFirstName,
    adminLastName,
    adminEmail,
    apiBase,
    loginUrl,
  });

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
