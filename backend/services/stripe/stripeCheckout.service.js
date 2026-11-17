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
  tryResolveStripeAddOnPriceId,
  hasStripePlanPricesConfigured,
  mapStripePriceIdsToAddOnCodes,
} = require("./stripePriceMap");
const {
  filterAddOnsForPackage,
} = require("../../utils/subscription/addOnCatalog");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("../ghl/ghlCheckoutErrors");
const { commonLogs } = require("../logger/contextLogger");

const MAX_STRIPE_OPTIONAL_ITEMS = 10;

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
 * Offer remaining package add-ons on Stripe Checkout (customer can toggle).
 * Pre-selected add-ons stay in line_items; these are optional_items.
 * @returns {Array<object>}
 */
function buildOptionalAddOnItems({
  packageCode,
  billingCycle,
  purchasedAddOns = [],
  offerOptionalAddOns = false,
}) {
  if (!offerOptionalAddOns) return [];

  const selected = new Set(
    (purchasedAddOns || []).map((a) => String(a.code || "").toUpperCase()),
  );
  const available = filterAddOnsForPackage(packageCode, billingCycle).filter(
    (addOn) => !selected.has(String(addOn.code || "").toUpperCase()),
  );

  const optionalItems = [];
  for (const addOn of available) {
    if (optionalItems.length >= MAX_STRIPE_OPTIONAL_ITEMS) break;
    const resolved = tryResolveStripeAddOnPriceId(
      addOn.code,
      billingCycle,
      packageCode,
    );
    if (!resolved?.priceId) continue;

    const item = {
      price: resolved.priceId,
      quantity: 1,
    };
    if (addOn.quantityBased) {
      item.adjustable_quantity = {
        enabled: true,
        minimum: 0,
        maximum: 25,
      };
    }
    optionalItems.push(item);
  }
  return optionalItems;
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
 *   trialPeriodDays?: number,
 *   offerOptionalAddOns?: boolean,
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
    trialPeriodDays = 0,
    offerOptionalAddOns = Number(trialPeriodDays) > 0,
  } = args;

  const plan = resolveStripePriceId(packageCode, billingCycle);
  const lineItems = [{ price: plan.priceId, quantity: 1 }];

  // Include selected add-ons on trial checkouts too — Stripe trial_period_days
  // covers the whole subscription ($0 today, plan + add-ons bill after trial).
  for (const addon of purchasedAddOns) {
    const qty = Math.max(1, Number(addon.quantity) || 1);
    const resolved = resolveStripeAddOnPriceId(
      addon.code,
      billingCycle,
      packageCode,
    );
    lineItems.push({ price: resolved.priceId, quantity: qty });
  }

  const optionalItems = buildOptionalAddOnItems({
    packageCode,
    billingCycle,
    purchasedAddOns,
    offerOptionalAddOns,
  });

  return createStripeCheckoutSession({
    email,
    customerName,
    packageCode,
    billingCycle,
    lineItems,
    optionalItems,
    successUrl,
    cancelUrl,
    checkoutId,
    metadata: {
      ...metadata,
      ...(optionalItems.length > 0 ? { stripeOptionalAddOns: "true" } : {}),
    },
    planPriceId: plan.priceId,
    trialPeriodDays,
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
    trialPeriodDays = 0,
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
    // When the broker is still on a plan free trial, keep add-on checkout $0
    // until the remaining trial days elapse.
    trialPeriodDays,
  });
}

async function createStripeCheckoutSession({
  email,
  customerName,
  packageCode,
  billingCycle,
  lineItems,
  optionalItems = [],
  successUrl,
  cancelUrl,
  checkoutId,
  metadata = {},
  planPriceId,
  trialPeriodDays = 0,
}) {
  const trialDays = Math.max(0, Math.floor(Number(trialPeriodDays) || 0));
  const meta = {};
  for (const [key, value] of Object.entries({
    lendingCartCheckoutId: checkoutId,
    packageCode,
    billingCycle,
    provider: "stripe",
    customerName: customerName || undefined,
    withFreeTrial: trialDays > 0 ? "true" : undefined,
    trialPeriodDays: trialDays > 0 ? String(trialDays) : undefined,
    ...metadata,
  })) {
    if (value == null) continue;
    const str = Array.isArray(value) ? value.join(",") : String(value);
    if (!str) continue;
    meta[String(key).slice(0, 40)] = str.slice(0, 500);
  }

  try {
    const stripe = getStripeClient();
    const subscriptionData = {
      metadata: {
        lendingCartCheckoutId: checkoutId,
        packageCode: String(packageCode || ""),
        billingCycle: String(billingCycle || ""),
        type: String(metadata.type || "PLAN"),
        ...(trialDays > 0
          ? { withFreeTrial: "true", trialPeriodDays: String(trialDays) }
          : {}),
      },
    };
    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const sessionParams = {
      mode: "subscription",
      customer_email: String(email || "").trim().toLowerCase() || undefined,
      line_items: lineItems,
      success_url: withStripeSessionPlaceholder(successUrl),
      cancel_url: cancelUrl || successUrl,
      client_reference_id: checkoutId,
      metadata: meta,
      subscription_data: subscriptionData,
      // Require a card even when trial_period_days makes amount due today $0.
      ...(trialDays > 0 ? { payment_method_collection: "always" } : {}),
      allow_promotion_codes: trialDays > 0 ? false : true,
      billing_address_collection: "auto",
    };
    if (Array.isArray(optionalItems) && optionalItems.length > 0) {
      sessionParams.optional_items = optionalItems.slice(
        0,
        MAX_STRIPE_OPTIONAL_ITEMS,
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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
      optionalItemCount: Array.isArray(optionalItems) ? optionalItems.length : 0,
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
      optionalItemCount: Array.isArray(optionalItems) ? optionalItems.length : 0,
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
    const stripeMsg = String(err?.message || "");
    if (
      err?.code === "resource_missing" ||
      /no such price/i.test(stripeMsg) ||
      (/live mode/i.test(stripeMsg) && /test mode/i.test(stripeMsg))
    ) {
      throw checkoutError(
        CHECKOUT_ERROR_CODES.STRIPE_PRICE_MODE_MISMATCH,
        503,
      );
    }
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

/**
 * List Checkout Session line items and map add-on Stripe prices → codes.
 * Includes items the customer added via optional_items on the Stripe page.
 */
async function extractAddOnCodesFromStripeSession(sessionId) {
  if (!sessionId || !isStripeConfigured()) return [];
  const stripe = getStripeClient();
  const linePrices = [];
  let startingAfter = undefined;
  for (let page = 0; page < 5; page += 1) {
    const listed = await stripe.checkout.sessions.listLineItems(
      String(sessionId),
      {
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
    );
    for (const item of listed?.data || []) {
      const priceId =
        typeof item.price === "string" ? item.price : item.price?.id || null;
      linePrices.push({
        priceId,
        quantity: item.quantity,
      });
    }
    if (!listed?.has_more || !(listed.data || []).length) break;
    startingAfter = listed.data[listed.data.length - 1].id;
  }
  return mapStripePriceIdsToAddOnCodes(linePrices);
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
  extractAddOnCodesFromStripeSession,
  isStripeCheckoutSessionPaid,
  withStripeSessionPlaceholder,
  buildOptionalAddOnItems,
};
