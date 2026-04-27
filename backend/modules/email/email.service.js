const ghlService = require("../ghl/ghl.service");

const sendEmail = async ({ to, name, subject, message }) => {
  const result = await ghlService.triggerWebhook({
    email: to,
    name: name || "User",        // ✅ dynamic name
    message: message || "",
    subject: subject || "Default Subject 🚀", // ✅ PASS SUBJECT
  });

  return {
    success: true,
    ghlResponse: result,
  };
};

module.exports = {
  sendEmail,
};