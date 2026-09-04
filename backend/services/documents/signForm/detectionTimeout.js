/**
 * Race a promise against a timeout. Does not cancel CPU work, but lets callers
 * fail fast and unblock the UI / mark FAILED.
 */
function withTimeout(promise, ms, label = "operation") {
  const timeoutMs = Math.max(1000, Number(ms) || 15000);
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${timeoutMs}ms`);
      err.code = "DETECTION_TIMEOUT";
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = {
  withTimeout,
};
