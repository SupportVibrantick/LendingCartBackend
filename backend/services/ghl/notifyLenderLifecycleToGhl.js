const axios = require("axios");
const { commonLogs } = require("../logger/contextLogger");

/**
 * Outbound lifecycle events → GHL Inbound Webhook (CRM / outreach stop).
 * NOT payment/CLM billing webhooks (/api/webhooks/ghl).
 *
 * Env: GHL_LENDER_LIFECYCLE_WEBHOOK_URL
 */

const LENDER_LIFECYCLE_EVENTS = Object.freeze({
  SIGNED_UP: "lender_signed_up",
  PROFILE_COMPLETED: "profile_completed",
  FIRST_DEAL_MATCHED: "first_deal_matched",
  DEAL_VIEWED: "deal_viewed",
  DEAL_RESPONDED: "deal_responded",
  INACTIVE_14_DAYS: "inactive_14_days",
});

function getLenderLifecycleWebhookUrl() {
  return String(process.env.GHL_LENDER_LIFECYCLE_WEBHOOK_URL || "").trim();
}

function isLenderLifecycleWebhookConfigured() {
  return Boolean(getLenderLifecycleWebhookUrl());
}

/**
 * @param {object} input
 * @param {string} input.event
 * @param {string} input.email
 * @param {string} [input.firstName]
 * @param {string} [input.lastName]
 * @param {string} [input.phone]
 * @param {string} [input.company]
 * @param {string} [input.lenderId]
 * @param {string} [input.signupDate] ISO date YYYY-MM-DD
 * @param {number} [input.dealsMatchedCount]
 * @param {string} [input.lastLogin]
 * @param {import("fastify").FastifyBaseLogger | Console} [logger]
 */
async function notifyLenderLifecycleToGhl(input = {}, { logger } = {}) {
  const log = logger || commonLogs;
  const url = getLenderLifecycleWebhookUrl();

  if (!url) {
    log.info("GHL lender lifecycle webhook skipped — GHL_LENDER_LIFECYCLE_WEBHOOK_URL unset", {
      event: input.event,
      email: input.email,
    });
    return { skipped: true, reason: "WEBHOOK_URL_UNSET" };
  }

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const event = String(input.event || "").trim();

  if (!email || !event) {
    log.warn("GHL lender lifecycle webhook skipped — email and event required", {
      event,
      email,
    });
    return { skipped: true, reason: "MISSING_FIELDS" };
  }

  const payload = {
    event,
    email,
    first_name: input.firstName ? String(input.firstName).trim() : "",
    last_name: input.lastName ? String(input.lastName).trim() : "",
    phone: input.phone ? String(input.phone).trim() : "",
    company: input.company ? String(input.company).trim() : "",
    lender_id: input.lenderId ? String(input.lenderId).trim() : "",
    signup_date:
      input.signupDate ||
      (event === LENDER_LIFECYCLE_EVENTS.SIGNED_UP
        ? new Date().toISOString().slice(0, 10)
        : undefined),
  };

  if (input.dealsMatchedCount != null) {
    payload.deals_matched_count = Number(input.dealsMatchedCount);
  }
  if (input.lastLogin) {
    payload.last_login = String(input.lastLogin);
  }

  try {
    const res = await axios.post(url, payload, {
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
      validateStatus: (s) => s >= 200 && s < 300,
    });

    log.info("GHL lender lifecycle webhook ok", {
      event,
      email,
      status: res.status,
      lenderId: payload.lender_id || undefined,
    });

    return { skipped: false, status: res.status, data: res.data };
  } catch (err) {
    log.warn("GHL lender lifecycle webhook failed", {
      event,
      email,
      status: err.response?.status || null,
      message: err.message,
      data: err.response?.data ?? null,
    });
    return {
      skipped: false,
      failed: true,
      status: err.response?.status || null,
      error: err.message,
    };
  }
}

/**
 * Fire-and-forget wrapper — never throws to callers.
 */
function notifyLenderSignedUpToGhl(input, opts) {
  const payload = {
    ...input,
    event: LENDER_LIFECYCLE_EVENTS.SIGNED_UP,
  };

  Promise.resolve()
    .then(() => notifyLenderLifecycleToGhl(payload, opts))
    .catch((err) => {
      (opts?.logger || commonLogs).warn(
        "GHL lender signed-up notify unexpected error",
        { err: err?.message, email: input?.email },
      );
    });
}

module.exports = {
  LENDER_LIFECYCLE_EVENTS,
  getLenderLifecycleWebhookUrl,
  isLenderLifecycleWebhookConfigured,
  notifyLenderLifecycleToGhl,
  notifyLenderSignedUpToGhl,
};
