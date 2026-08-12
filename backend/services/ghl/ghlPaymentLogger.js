/**
 * Structured logging for GHL checkout / payment / webhook flows.
 * Never logs API keys, passwords, card data, or payment credentials.
 */

const { commonLogs } = require("../logger/contextLogger");

const GHL_PAYMENT_EVENTS = {
  CHECKOUT_INITIATED: "ghl.checkout.initiated",
  CHECKOUT_CREATED: "ghl.checkout.created",
  CHECKOUT_REUSED: "ghl.checkout.reused",
  CHECKOUT_FAILED: "ghl.checkout.failed",
  PAYMENT_STATUS_CHANGED: "ghl.payment.status_changed",
  SUBSCRIPTION_STATUS_CHANGED: "ghl.subscription.status_changed",
  WEBHOOK_RECEIVED: "ghl.webhook.received",
  WEBHOOK_PROCESSED: "ghl.webhook.processed",
  WEBHOOK_DUPLICATE: "ghl.webhook.duplicate",
  WEBHOOK_FAILED: "ghl.webhook.failed",
  WEBHOOK_IGNORED: "ghl.webhook.ignored",
};

const SENSITIVE_KEY_PATTERN =
  /api[_-]?key|authorization|password|passwd|secret|token|bearer|card|cvv|cvc|pan|credit|debit|expir(y|ation)|payment[_-]?method|pit-|ghl[_-]?api/i;

const SENSITIVE_VALUE_PATTERN =
  /\b(pit-[a-z0-9]+|Bearer\s+\S+|sk_live_|sk_test_|pk_live_|pk_test_)\b/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactValue(key, value) {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ""))) {
    return "[REDACTED]";
  }
  if (typeof value === "string" && SENSITIVE_VALUE_PATTERN.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

/**
 * Deep-sanitize a log fields object. Drops unknown nested blobs that may
 * contain provider secrets; keeps only safe scalars / shallow objects.
 */
function sanitizeLogFields(fields = {}, depth = 0) {
  if (fields == null) return {};
  if (depth > 3) return "[TRUNCATED]";

  if (Array.isArray(fields)) {
    return fields.slice(0, 20).map((item) => {
      if (isPlainObject(item) || Array.isArray(item)) {
        return sanitizeLogFields(item, depth + 1);
      }
      return redactValue("", item);
    });
  }

  if (!isPlainObject(fields)) {
    return redactValue("", fields);
  }

  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (isPlainObject(value) || Array.isArray(value)) {
      out[key] = sanitizeLogFields(value, depth + 1);
      continue;
    }
    out[key] = redactValue(key, value);
  }
  return out;
}

/**
 * Build a consistent checkout/payment context for logs.
 */
function checkoutLogContext(partial = {}) {
  return sanitizeLogFields({
    event: partial.event || null,
    checkoutId: partial.checkoutId || null,
    loanAiUserId: partial.loanAiUserId || partial.userId || null,
    packageId: partial.packageId || null,
    packageCode: partial.packageCode || null,
    billingPeriod: partial.billingPeriod || partial.billingCycle || null,
    ghlContactId: partial.ghlContactId || null,
    ghlPriceId: partial.ghlPriceId || null,
    ghlProductId: partial.ghlProductId || null,
    ghlInvoiceId: partial.ghlInvoiceId || null,
    ghlSubscriptionId: partial.ghlSubscriptionId || null,
    paymentStatus: partial.paymentStatus || null,
    subscriptionStatus: partial.subscriptionStatus || null,
    status: partial.status || null,
    previousStatus: partial.previousStatus || null,
    organizationSubscriptionId: partial.organizationSubscriptionId || null,
    webhookId: partial.webhookId || null,
    eventType: partial.eventType || null,
    lifecycle: partial.lifecycle || null,
    action: partial.action || null,
    amount: partial.amount != null ? Number(partial.amount) : undefined,
    currency: partial.currency || undefined,
    reused: partial.reused,
    code: partial.code || undefined,
    reason: partial.reason || undefined,
    message: partial.message
      ? String(partial.message).slice(0, 300)
      : undefined,
  });
}

function logGhlPayment(level, event, fields = {}) {
  const payload = checkoutLogContext({ ...fields, event });
  const logger =
    level === "error"
      ? commonLogs.error.bind(commonLogs)
      : level === "warn"
        ? commonLogs.warn.bind(commonLogs)
        : commonLogs.info.bind(commonLogs);

  logger(event, payload);
  return payload;
}

function logCheckoutInitiated(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.CHECKOUT_INITIATED, fields);
}

function logCheckoutCreated(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.CHECKOUT_CREATED, fields);
}

function logCheckoutReused(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.CHECKOUT_REUSED, fields);
}

function logCheckoutFailed(fields) {
  return logGhlPayment("error", GHL_PAYMENT_EVENTS.CHECKOUT_FAILED, fields);
}

function logPaymentStatusChanged(fields) {
  return logGhlPayment(
    "info",
    GHL_PAYMENT_EVENTS.PAYMENT_STATUS_CHANGED,
    fields,
  );
}

function logSubscriptionStatusChanged(fields) {
  return logGhlPayment(
    "info",
    GHL_PAYMENT_EVENTS.SUBSCRIPTION_STATUS_CHANGED,
    fields,
  );
}

function logWebhookReceived(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.WEBHOOK_RECEIVED, fields);
}

function logWebhookProcessed(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.WEBHOOK_PROCESSED, fields);
}

function logWebhookDuplicate(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.WEBHOOK_DUPLICATE, fields);
}

function logWebhookFailed(fields) {
  return logGhlPayment("error", GHL_PAYMENT_EVENTS.WEBHOOK_FAILED, fields);
}

function logWebhookIgnored(fields) {
  return logGhlPayment("info", GHL_PAYMENT_EVENTS.WEBHOOK_IGNORED, fields);
}

module.exports = {
  GHL_PAYMENT_EVENTS,
  sanitizeLogFields,
  checkoutLogContext,
  logGhlPayment,
  logCheckoutInitiated,
  logCheckoutCreated,
  logCheckoutReused,
  logCheckoutFailed,
  logPaymentStatusChanged,
  logSubscriptionStatusChanged,
  logWebhookReceived,
  logWebhookProcessed,
  logWebhookDuplicate,
  logWebhookFailed,
  logWebhookIgnored,
};
