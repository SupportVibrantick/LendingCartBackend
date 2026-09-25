/**
 * Stripe helpers for CLM discontinue (cancel GHL-created $699 subscriptions).
 * Uses the same Stripe account connected to GHL Payments (STRIPE_SECRET_KEY).
 */

const { commonLogs } = require("../logger/contextLogger");

function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}

function getStripeClient() {
  const key = getStripeSecretKey();
  if (!key) {
    throw Object.assign(new Error("STRIPE_SECRET_KEY is not configured"), {
      code: "STRIPE_NOT_CONFIGURED",
      statusCode: 503,
    });
  }
  // Lazy require so app boots without stripe if unused.
  const Stripe = require("stripe");
  return new Stripe(key);
}

function looksLikeStripeSubscriptionId(value) {
  const id = String(value || "").trim();
  return /^sub_[A-Za-z0-9]+$/.test(id);
}

function looksLikeStripeCustomerId(value) {
  const id = String(value || "").trim();
  return /^cus_[A-Za-z0-9]+$/.test(id);
}

/**
 * Pull Stripe ids from GHL / mixed webhook payloads when present.
 */
function extractStripeIdsFromPayload(body = {}) {
  const subscription = body.subscription || body.data?.subscription || {};
  const invoice = body.invoice || body.data?.invoice || {};
  const order = body.order || body.data?.order || {};
  const customData = body.customData || body.data?.customData || {};

  const candidates = [
    body.stripeSubscriptionId,
    body.stripe_subscription_id,
    customData.stripeSubscriptionId,
    customData.stripe_subscription_id,
    subscription.stripeSubscriptionId,
    subscription.stripe_subscription_id,
    subscription.providerSubscriptionId,
    subscription.externalId,
    invoice.stripeSubscriptionId,
    order.stripeSubscriptionId,
    // Sometimes GHL stores the Stripe sub id as the subscription id itself
    subscription.id,
    body.subscriptionId,
  ];

  let stripeSubscriptionId = null;
  for (const c of candidates) {
    if (looksLikeStripeSubscriptionId(c)) {
      stripeSubscriptionId = String(c).trim();
      break;
    }
  }

  const customerCandidates = [
    body.stripeCustomerId,
    body.stripe_customer_id,
    customData.stripeCustomerId,
    subscription.stripeCustomerId,
    subscription.customer,
    invoice.stripeCustomerId,
    invoice.customer,
  ];

  let stripeCustomerId = null;
  for (const c of customerCandidates) {
    if (looksLikeStripeCustomerId(c)) {
      stripeCustomerId = String(c).trim();
      break;
    }
  }

  return { stripeSubscriptionId, stripeCustomerId };
}

/**
 * Find active/trialing subscriptions for a customer email.
 * Prefer product/price hints when provided.
 */
async function findStripeSubscriptionsByEmail(email, { priceId = null } = {}) {
  if (!isStripeConfigured() || !email) {
    return [];
  }

  const stripe = getStripeClient();
  const normalized = String(email).trim().toLowerCase();

  const customers = await stripe.customers.list({
    email: normalized,
    limit: 10,
  });

  const results = [];
  for (const customer of customers.data || []) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 20,
    });
    for (const sub of subs.data || []) {
      if (["canceled", "incomplete_expired"].includes(sub.status)) continue;
      if (priceId) {
        const hasPrice = (sub.items?.data || []).some(
          (item) => item.price?.id === priceId,
        );
        if (!hasPrice) continue;
      }
      results.push({
        subscriptionId: sub.id,
        customerId: customer.id,
        status: sub.status,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      });
    }
  }

  return results;
}

/**
 * Resolve the best Stripe subscription id to cancel for a CLM org subscription.
 */
async function resolveStripeSubscriptionForClm(sub, { email = null } = {}) {
  if (looksLikeStripeSubscriptionId(sub?.stripeSubscriptionId)) {
    return {
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeCustomerId: sub.stripeCustomerId || null,
      source: "db",
    };
  }

  // Sometimes GHL stores the Stripe sub id in ghlSubscriptionId
  if (looksLikeStripeSubscriptionId(sub?.ghlSubscriptionId)) {
    return {
      stripeSubscriptionId: sub.ghlSubscriptionId,
      stripeCustomerId: sub.stripeCustomerId || null,
      source: "ghlSubscriptionId_as_stripe",
    };
  }

  if (!isStripeConfigured()) {
    return { stripeSubscriptionId: null, reason: "stripe_not_configured" };
  }

  const priceId = String(process.env.STRIPE_CLM_PRICE_ID || "").trim() || null;
  const found = await findStripeSubscriptionsByEmail(email, { priceId });

  if (!found.length && !priceId) {
    // Retry without price filter already done; empty
  }

  // Prefer trialing/active monthly-looking subs
  const preferred =
    found.find((s) => s.status === "trialing") ||
    found.find((s) => s.status === "active") ||
    found[0];

  if (!preferred) {
    return { stripeSubscriptionId: null, reason: "no_stripe_subscription_found" };
  }

  return {
    stripeSubscriptionId: preferred.subscriptionId,
    stripeCustomerId: preferred.customerId,
    source: "email_lookup",
    status: preferred.status,
  };
}

/**
 * Immediately cancel a Stripe subscription (no further charges).
 */
async function cancelStripeSubscription(subscriptionId, { invoiceNow = false } = {}) {
  if (!looksLikeStripeSubscriptionId(subscriptionId)) {
    return {
      cancelled: false,
      reason: "invalid_stripe_subscription_id",
      subscriptionId: subscriptionId || null,
    };
  }

  if (!isStripeConfigured()) {
    return {
      cancelled: false,
      reason: "stripe_not_configured",
      subscriptionId,
    };
  }

  try {
    const stripe = getStripeClient();
    const cancelled = await stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: invoiceNow,
      prorate: false,
    });

    commonLogs.info("Stripe subscription cancelled", {
      event: "stripe.subscription.cancelled",
      subscriptionId,
      status: cancelled.status,
    });

    return {
      cancelled: true,
      subscriptionId,
      status: cancelled.status,
      customerId:
        typeof cancelled.customer === "string"
          ? cancelled.customer
          : cancelled.customer?.id || null,
    };
  } catch (err) {
    // Already cancelled is success for our purposes
    if (err?.code === "resource_missing") {
      return {
        cancelled: true,
        alreadyGone: true,
        subscriptionId,
        reason: "already_missing",
      };
    }
    if (
      String(err?.message || "")
        .toLowerCase()
        .includes("canceled") ||
      err?.code === "subscription_already_canceled"
    ) {
      return {
        cancelled: true,
        alreadyCancelled: true,
        subscriptionId,
      };
    }

    commonLogs.warn("Stripe subscription cancel failed", {
      subscriptionId,
      error: err?.message,
      code: err?.code,
    });

    return {
      cancelled: false,
      subscriptionId,
      reason: err?.message || "stripe_cancel_failed",
      code: err?.code || null,
    };
  }
}

/**
 * Construct + verify Stripe webhook event (requires raw body Buffer).
 */
function constructStripeWebhookEvent(rawBody, signatureHeader) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    throw Object.assign(new Error("STRIPE_WEBHOOK_SECRET is not configured"), {
      code: "STRIPE_WEBHOOK_SECRET_MISSING",
      statusCode: 503,
    });
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signatureHeader,
    secret,
  );
}

module.exports = {
  isStripeConfigured,
  getStripeClient,
  looksLikeStripeSubscriptionId,
  looksLikeStripeCustomerId,
  extractStripeIdsFromPayload,
  findStripeSubscriptionsByEmail,
  resolveStripeSubscriptionForClm,
  cancelStripeSubscription,
  constructStripeWebhookEvent,
};
