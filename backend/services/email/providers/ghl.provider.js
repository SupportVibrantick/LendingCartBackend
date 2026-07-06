const ghlService = require("../../../modules/ghl/ghl.service");
const { isGhlEnabled } = require("../../../config/env");

async function sendViaGhl({ to, subject, text, html, providerMeta = {} }) {
  if (!isGhlEnabled()) {
    return { skipped: true, provider: "GHL" };
  }

  const name = providerMeta.name || "User";
  const message = providerMeta.message || text || html || "";

  return ghlService.triggerWebhook({
    email: to,
    name,
    subject,
    message,
  });
}

module.exports = {
  sendViaGhl,
};
