const { enqueueEmail } = require("./email");

/**
 * Backward-compatible mail entrypoint.
 * Enqueues email for async delivery by the worker process.
 */
module.exports = async function sendMail(mailOptions = {}) {
  return enqueueEmail({
    prisma: mailOptions.prisma,
    to: mailOptions.to,
    cc: mailOptions.cc,
    bcc: mailOptions.bcc,
    subject: mailOptions.subject,
    text: mailOptions.text,
    html: mailOptions.html,
    idempotencyKey: mailOptions.idempotencyKey,
    provider: "SMTP",
  });
};
