require("dotenv").config();
const nodemailer = require("nodemailer");
const logger = require("./logger/contextLogger");

// Load SMTP variables
const EMAIL_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const EMAIL_PORT = process.env.SMTP_PORT || 465;
const EMAIL_USER = process.env.SMTP_USER || "mailerbot@vibrantick.in";
const EMAIL_PASSWORD = process.env.SMTP_PASS || "Mailerbot@123";

if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASSWORD) {
  logger.commonLogs.error(
    "Missing required SMTP environment variables. Please check .env file.",
  );
}

// Create transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: Number(EMAIL_PORT) === 465, // true for 465, false otherwise
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

// SMTP READY CHECK
(async () => {
  try {
    await transporter.verify();
    console.log(`\n✅ SMTP Ready: Connected to ${EMAIL_HOST}:${EMAIL_PORT}\n`);
  } catch (err) {
    console.log(
      `\n❌ SMTP Error: Unable to connect to mail server\n`,
      err.message,
    );
  }
})();

// SEND MAIL FUNCTION
const sendMail = async (mailOptions = {}) => {
  try {
    const recipient = mailOptions?.to || "unknown recipient";

    if (!mailOptions.to) {
      logger.commonLogs.info(`Attempted to send mail with no recipient.`);
      return;
    }

    if (!mailOptions.from) {
      mailOptions.from = EMAIL_USER;
    }

    const info = await transporter.sendMail(mailOptions);

    logger.commonLogs.info(
      `Mail sent successfully to ${recipient} with messageId=${info.messageId}`,
    );

    return info;
  }catch (error) {

  console.log(
    "\n❌ FULL SMTP ERROR:\n",
    error
  );

  logger.commonLogs.error(
    `Error in Sending Mail to ${mailOptions.to}`,
    {
      error,
    }
  );

  throw error;
}
};

module.exports = sendMail;
