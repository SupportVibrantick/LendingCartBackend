/**
 * Stripe Checkout Sessions for Loan AI paid subscriptions.
 */

const {
  isStripeConfigured,
  getStripeClient,
} = require("./stripeBilling");
const {
  resolveStripePriceId,
  resolveStripeAddOnPriceId,
  hasStripePlanPricesConfigured,
} = require("./stripePriceMap");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("../ghl/ghlCheckoutErrors");
const { commonLogs } = require("../logger/contextLogger");

function canProcessStripePayments() {
  return isStripeConfigured() && hasStripePlanPricesConfigured();
}

function withStripeSessionPlaceholder(url) {
  if (!url) return url;
  const raw = String(url);
  if (raw.includes("{CHECKOUT_SESSION_ID}")) return raw;
  const join = raw.includes("?") ? "&" : "?";
  return `${raw}${join}session_id={CHECKOUT_SESSION_ID}`;
}

/**
 * @param {{
 *   email: string,
 *   customerName?: string,
 *   packageCode: string,
 *   billingCycle: 'MONTHLY'|'YEARLY',
 *   addOnCodes?: string[],
 *   purchasedAddOns?: { code: string, quantity?: number }[],
 *   successUrl: string,
 *   cancelUrl: string,
 *   checkoutId: string,
 *   metadata?: Record<string, string>,
 * }} args
 */
async function createStripeSubscriptionCheckout(args) {
  if (!canProcessStripePayments()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.PAYMENTS_UNAVAILABLE, 503);
  }

  const {
    email,
    customerName,
    packageCode,
    billingCycle,
    purchasedAddOns = [],
    successUrl,
    cancelUrl,
    checkoutId,
    metadata = {},
  } = args;

  const plan = resolveStripePriceId(packageCode, billingCycle);
  const lineItems = [{ price: plan.priceId, quantity: 1 }];

  for (const addon of purchasedAddOns) {
    const qty = Math.max(1, Number(addon.quantity) || 1);
    const resolved = resolveStripeAddOnPriceId(
      addon.code,
      billingCycle,
      packageCode,
    );
    lineItems.push({ price: resolved.priceId, quantity: qty });
  }

  return createStripeCheckoutSession({
    email,
    customerName,
    packageCode,
    billingCycle,
    lineItems,
    successUrl,
    cancelUrl,
    checkoutId,
    metadata,
    planPriceId: plan.priceId,
  });
}

/**
 * Mid-cycle add-on / seat upgrade — Stripe Checkout with add-on prices only
 * (no base plan line item).
 */
async function createStripeAddOnOnlyCheckout(args) {
  if (!canProcessStripePayments()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.PAYMENTS_UNAVAILABLE, 503);
  }

  const {
    email,
    customerName,
    packageCode,
    billingCycle,
    purchasedAddOns = [],
    successUrl,
    cancelUrl,
    checkoutId,
    metadata = {},
  } = args;

  if (!Array.isArray(purchasedAddOns) || purchasedAddOns.length === 0) {
    throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_ADDON, 400);
  }

  const lineItems = [];
  let firstPriceId = null;
  for (const addon of purchasedAddOns) {
    const qty = Math.max(1, Number(addon.quantity) || 1);
    const resolved = resolveStripeAddOnPriceId(
      addon.code,
      billingCycle,
      packageCode,
    );
    if (!firstPriceId) firstPriceId = resolved.priceId;
    lineItems.push({ price: resolved.priceId, quantity: qty });
  }

  return createStripeCheckoutSession({
    email,
    customerName,
    packageCode,
    billingCycle,
    lineItems,
    successUrl,
    cancelUrl,
    checkoutId,
    metadata: { type: "ADDON_UPGRADE", ...metadata },
    planPriceId: firstPriceId,
  });
}

async function createStripeCheckoutSession({
  email,
  customerName,
  packageCode,
  billingCycle,
  lineItems,
  successUrl,
  cancelUrl,
  checkoutId,
  metadata = {},
  planPriceId,
}) {
  const meta = {};
  for (const [key, value] of Object.entries({
    lendingCartCheckoutId: checkoutId,
    packageCode,
    billingCycle,
    provider: "stripe",
    customerName: customerName || undefined,
    ...metadata,
  })) {
    if (value == null) continue;
    const str = Array.isArray(value) ? value.join(",") : String(value);
    if (!str) continue;
    meta[String(key).slice(0, 40)] = str.slice(0, 500);
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: String(email || "").trim().toLowerCase() || undefined,
      line_items: lineItems,
      success_url: withStripeSessionPlaceholder(successUrl),
      cancel_url: cancelUrl || successUrl,
      client_reference_id: checkoutId,
      metadata: meta,
      subscription_data: {
        metadata: {
          lendingCartCheckoutId: checkoutId,
          packageCode: String(packageCode || ""),
          billingCycle: String(billingCycle || ""),
          type: String(metadata.type || "PLAN"),
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    if (!session?.url) {
      throw checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
    }

    commonLogs.info("Stripe checkout session created", {
      event: "stripe.checkout.session.created",
      checkoutId,
      sessionId: session.id,
      packageCode,
      billingCycle,
      lineItemCount: lineItems.length,
      type: metadata.type || "PLAN",
    });

    return {
      provider: "stripe",
      checkoutUrl: session.url,
      sessionId: session.id,
      priceId: planPriceId,
      amount:
        typeof session.amount_total === "number"
          ? session.amount_total / 100
          : null,
      currency: session.currency || "usd",
    };
  } catch (err) {
    if (err?.code && Object.values(CHECKOUT_ERROR_CODES).includes(err.code)) {
      throw err;
    }
    commonLogs.warn("Stripe checkout session create failed", {
      checkoutId,
      error: err?.message,
      type: err?.type,
      code: err?.code,
    });
    throw checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
  }
}

async function retrieveStripeCheckoutSession(sessionId) {
  if (!sessionId || !isStripeConfigured()) return null;
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(String(sessionId), {
    expand: ["subscription", "customer"],
  });
}

function isStripeCheckoutSessionPaid(session) {
  if (!session) return false;
  const paymentStatus = String(session.payment_status || "").toLowerCase();
  const status = String(session.status || "").toLowerCase();
  return (
    paymentStatus === "paid" ||
    paymentStatus === "no_payment_required" ||
    status === "complete"
  );
}

module.exports = {
  canProcessStripePayments,
  createStripeSubscriptionCheckout,
  createStripeAddOnOnlyCheckout,
  retrieveStripeCheckoutSession,
  isStripeCheckoutSessionPaid,
  withStripeSessionPlaceholder,
};
