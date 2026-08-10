const nodemailer = require("nodemailer");
const { isEmailEnabled, getSmtpConfig } = require("../../../config/env");

let transporter = null;

function getTransporter() {
  if (!isEmailEnabled()) {
    return null;
  }

  if (!transporter) {
    const smtp = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });
  }

  return transporter;
}

async function sendViaSmtp({ to, cc, bcc, subject, text, html, attachments, from }) {
  if (!isEmailEnabled()) {
    return { messageId: "email-disabled", skipped: true };
  }

  const smtp = getSmtpConfig();
  const activeTransporter = getTransporter();

  const info = await activeTransporter.sendMail({
    to,
    cc,
    bcc,
    from: from || smtp.from,
    subject,
    text,
    html,
    attachments: attachments && attachments.length ? attachments : undefined,
  });

  return info;
}

module.exports = {
  sendViaSmtp,
};
