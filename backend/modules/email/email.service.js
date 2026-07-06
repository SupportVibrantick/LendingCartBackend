const { enqueueGhlEmail } = require("../../services/email");

const sendEmail = async ({ prisma, to, name, subject, message }) => {
  const outbox = await enqueueGhlEmail({
    prisma,
    to,
    subject: subject || "Default Subject",
    text: message || "",
    providerMeta: {
      name: name || "User",
      message: message || "",
    },
    idempotencyKey: `ghl-manual:${to}:${subject || "default"}:${Date.now()}`,
  });

  return {
    success: true,
    outboxId: outbox.id,
    status: outbox.status,
  };
};

module.exports = {
  sendEmail,
};
