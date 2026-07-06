const { acquireJobLock, releaseJobLock } = require("./lock.service");
const { schedulerLogs } = require("../logger/contextLogger");

function logCronEvent(log, level, message, fields = {}) {
  schedulerLogs[level](message, fields);

  if (!log || log === schedulerLogs) {
    return;
  }

  if (typeof log[level] === "function") {
    if (log.child) {
      log[level](fields, message);
    } else {
      log[level](message, fields);
    }
  }
}

/**
 * Run a cron handler behind a distributed lock with structured metrics logging.
 */
async function runCronJob({
  prisma,
  log,
  jobName,
  ttlMs,
  handler,
}) {
  const startedAt = Date.now();
  const lock = await acquireJobLock(prisma, jobName, { ttlMs });

  if (!lock.acquired) {
    logCronEvent(log, "info", "Cron tick skipped — lock held by another worker", {
      jobName,
      skipped: true,
      reason: "lock_not_acquired",
    });
    return { skipped: true, jobName };
  }

  try {
    const result = (await handler()) || {};
    const durationMs = Date.now() - startedAt;

    logCronEvent(log, "info", "Cron job completed", {
      jobName,
      durationMs,
      skipped: false,
      ...normalizeMetrics(result),
    });

    return { skipped: false, jobName, durationMs, ...result };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logCronEvent(log, "error", "Cron job failed", {
      jobName,
      durationMs,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  } finally {
    await releaseJobLock(prisma, jobName, lock.workerId);
  }
}

function normalizeMetrics(result) {
  if (!result || typeof result !== "object") {
    return {};
  }

  const metrics = {};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      metrics[key] = value;
    }
  }

  return metrics;
}

module.exports = {
  runCronJob,
};
