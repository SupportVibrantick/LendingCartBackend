function registerProcessSafetyHandlers(processName = "api") {
  const prefix = `[${processName}]`;

  process.on("unhandledRejection", (reason) => {
    console.error(`${prefix} Unhandled promise rejection:`, reason);
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    console.error(`${prefix} Uncaught exception:`, error);
    process.exit(1);
  });
}

module.exports = {
  registerProcessSafetyHandlers,
};
