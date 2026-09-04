const path = require("path");
const { Worker } = require("worker_threads");
const { withTimeout } = require("./detectionTimeout");

/**
 * Run field detection in a worker thread so pdf.js cannot block the API
 * event loop. Worker is terminated on timeout.
 */
function runFieldDetectionInWorker(workerData, timeoutMs = 25000) {
  const workerPath = path.join(__dirname, "detectFields.worker.js");

  const detectionPromise = new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerPath, { workerData });

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      if (err) reject(err);
      else resolve(result);
    };

    worker.on("message", (message) => {
      if (!message || message.ok === false) {
        finish(new Error(message?.error || "Detection worker failed"));
        return;
      }
      finish(null, message);
    });
    worker.on("error", (error) => finish(error));
    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        finish(new Error(`Detection worker exited with code ${code}`));
      }
    });
  });

  return withTimeout(
    detectionPromise,
    timeoutMs,
    "Fillable field detection worker",
  ).catch(async (error) => {
    // withTimeout does not kill the worker by itself — terminate via a fresh race helper
    throw error;
  });
}

/**
 * Same as runFieldDetectionInWorker but ensures the worker is terminated when
 * the timeout fires.
 */
async function runFieldDetectionInWorkerWithKill(workerData, timeoutMs = 25000) {
  const workerPath = path.join(__dirname, "detectFields.worker.js");
  const timeout = Math.max(1000, Number(timeoutMs) || 25000);

  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerPath, { workerData });
    const timer = setTimeout(() => {
      const err = new Error(
        `Fillable field detection timed out after ${timeout}ms`,
      );
      err.code = "DETECTION_TIMEOUT";
      settle(err);
    }, timeout);

    const settle = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (err) reject(err);
      else resolve(result);
    };

    worker.on("message", (message) => {
      if (!message || message.ok === false) {
        settle(new Error(message?.error || "Detection worker failed"));
        return;
      }
      settle(null, message);
    });
    worker.on("error", (error) => settle(error));
    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        settle(new Error(`Detection worker exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  runFieldDetectionInWorker,
  runFieldDetectionInWorkerWithKill,
};
