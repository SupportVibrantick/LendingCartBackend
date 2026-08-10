const { enqueueEmail } = require("../email");

/**
 * Backward-compatible mail entrypoint.
 * Enqueues email for async delivery by the worker process.
 *
 * Caller-supplied attachments are forwarded through. The default
 * logo is auto-attached by enqueueEmail when the HTML references
 * it via cid:.
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
    attachments: mailOptions.attachments,
    logoAttachment: mailOptions.logoAttachment,
    idempotencyKey: mailOptions.idempotencyKey,
    provider: "SMTP",
  });
};
