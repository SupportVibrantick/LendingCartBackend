const { createLogger, transports, format } = require("winston");
require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");

// Timezone for log timestamps
const timezoned = () => {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
};

// Ensure logs directory exists
const logsDir = path.join(__dirname,  '..', '..', "public", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Reusable function to create loggers for any context (admin, user, mail, etc.)
const createCustomLogger = (logType, daysLimit) => {
  const basePath = path.join(__dirname,  '..', '..', "public", "logs", logType);

  // Create directory if it doesn't exist
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const daysLimitNumber = parseInt(daysLimit, 10) || 7;

  const infoTransport = new transports.DailyRotateFile({
    filename: `${basePath}/info-%DATE%.log`,
    datePattern: "DD-MM-YYYY",
    maxFiles: `${daysLimitNumber}d`,
    level: "info",
    format: format.combine(
      format.timestamp({ format: timezoned }),
      format.json()
    ),
  });

  const errorTransport = new transports.DailyRotateFile({
    filename: `${basePath}/error-%DATE%.log`,
    datePattern: "DD-MM-YYYY",
    maxFiles: `${daysLimitNumber * 2}d`,
    level: "error",
    format: format.combine(
      format.timestamp({ format: timezoned }),
      format.json()
    ),
  });

  return createLogger({
    transports: [infoTransport, errorTransport],
  });
};

// Create loggers for admin, user, and any other context
const adminLogs = createCustomLogger("admin", 30);
const userLogs = createCustomLogger("user", 20);
const commonLogs = createCustomLogger("common", 10);
const kafkaLogs = createCustomLogger("kafka", 10);

module.exports = { adminLogs, userLogs, commonLogs, kafkaLogs };