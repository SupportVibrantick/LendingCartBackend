require("dotenv").config();
const nodemailer = require("nodemailer");

const logger = require("./logger/contextLogger");

// Validate Environment Variables
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD } = process.env;

if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASSWORD) {
  logger.commonLogs.error(
    "Missing required email environment variables. Please check .env file."
  );
  return;
}

// Create reusable transporter (reused across all emails)
const transporter = nodemailer.createTransport({
  host: String(EMAIL_HOST),
  port: Number(EMAIL_PORT),
  secure: true,
  // service: "Gmail",
  auth: {
    user: String(EMAIL_USER),
    pass: String(EMAIL_PASSWORD),
  },
});

// Function to send an email
const sendMail = async (mailOptions = {}) => {
  try {
    const recipient = mailOptions?.to || "unknown recipient";

    if (!mailOptions.to) {
      logger.commonLogs.info(`Attempted to send mail with no recipient.`);
      return;
    }

    // Attach from email if not provided
    if (!mailOptions.from) {
      mailOptions.from = process.env.EMAIL_USER;
    }

    const info = await transporter.sendMail(mailOptions);

    logger.commonLogs.info(
      `Mail sent successfully to ${recipient} with messageId=${info.messageId}`
    );

    return info; // Return the info in case calling function needs it
  } catch (error) {
    const recipient = mailOptions?.to || "unknown recipient";

    logger.commonLogs.error(`Error in Sending Mail to ${recipient}`, {
      error,
    });

    return error; // Return the error so the calling function can decide what to do next
  }
};

module.exports = sendMail;