const axios = require("axios");
const { isGhlEnabled } = require("../../config/env");

const triggerWebhook = async ({ email, name, message, subject }) => {
  if (!isGhlEnabled()) {
    console.log("GHL_ENABLED=false — webhook email skipped", {
      email,
      subject: subject || "Default Subject",
    });
    return { skipped: true, provider: "GHL" };
  }

  try {
    if (!email) {
      throw new Error("Email is required for GHL webhook");
    }

    const payload = {
      email,
      name: name || "User",
      message: message || "",
      subject: subject || "Default Subject",
    };

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
