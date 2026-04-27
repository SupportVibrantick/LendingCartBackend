const axios = require("axios");

const triggerWebhook = async ({ email, name, message, subject }) => {
  try {
    // ✅ Basic validation
    if (!email) {
      throw new Error("Email is required for GHL webhook");
    }

    // ✅ Prepare payload
    const payload = {
      email,
      name: name || "User",
      message: message || "",
      subject: subject || "Default Subject 🚀", // ✅ ADD THIS
    };

    // ✅ Call GHL webhook
    const res = await axios.post(process.env.GHL_WEBHOOK_URL, payload, {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("GHL SUCCESS:", {
      email,
      subject: payload.subject,
      responseId: res.data?.id,
    });

    return res.data;

  } catch (err) {
    console.error("❌ GHL Webhook Error:", {
      message: err.message,
      data: err.response?.data,
    });

    throw new Error("Failed to send email via GHL");
  }
};

module.exports = {
  triggerWebhook,
};