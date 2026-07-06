const { validateWorkerEnv } = require("../config/env");
const { registerProcessSafetyHandlers } = require("../config/processSafety");

registerProcessSafetyHandlers("worker");

try {
  validateWorkerEnv();
} catch (error) {
  console.error("Worker environment validation failed:", error.message);
  process.exit(1);
}

const app = require("../app");
const startSchedulers = require("../scheduler");
const { startEmailOutboxWorker } = require("../services/email");

app
  .ready()
  .then(async () => {
    startSchedulers(app);
    startEmailOutboxWorker(app.prisma);

    console.log("✅ LendingCart worker started (crons + email outbox enabled)");
  })
  .catch((error) => {
    console.error("Worker failed to start:", error);
    process.exit(1);
  });
