/**
 * GHL payment / checkout service.
 *
 * Uses the existing Lead Connector client (`modules/ghl/ghl.client.js`) with:
 *   Authorization: Bearer GHL_API_KEY
 *   Version: GHL_API_VERSION (default 2021-07-28)
 *   baseURL: GHL_API_BASE_URL
 *
 * Supported GHL APIs used here (project-compatible):
 *   - GET  /products/:productId/price/:priceId  (price details)
 *   - POST /invoices/                           (create invoice with productId + priceId)
 *   - POST /invoices/:invoiceId/send            (send / expose pay URL)
 *   - GET  /invoices/:invoiceId                 (fallback URL lookup)
 *   - GET  /payments/subscriptions/:id          (recurring subscription lookup)
 *   - GET  /payments/orders/:id                 (order lookup)
 *
 * Note: GHL has no public "create payment link" API. Checkout is initialized via
 * Invoices (one-time or recurring price items). Recurring interval is defined on
 * the GHL Price itself (mapped from env price IDs).
 */

const { isGhlEnabled, isGhlPaymentsLiveMode } = require("../../config/env");
const { createGhlApiClient } = require("../../modules/ghl/ghl.client");
const ghlService = require("../../modules/ghl/ghl.service");
const {
  getGhlProductId,
  resolveGhlPriceId,
  hasAllGhlPriceIdsConfigured,
  normalizePackageCode,
  normalizeBillingCycle,
} = require("./ghlPriceMap");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("./ghlCheckoutErrors");

/**
 * Single source of truth for invoice create + send liveMode.
 * Always resolve via isGhlPaymentsLiveMode() so create/send cannot diverge.
 */
function resolveCheckoutLiveMode(explicit) {
  if (typeof explicit === "boolean") return explicit;
  return isGhlPaymentsLiveMode();
}

/**
 * GHL invoices require E.164 phone (e.g. +15551234567).
 * Accepts digits / local US numbers and normalizes.
 */
function toE164Phone(phone, defaultCountryCode = "1") {
  if (phone == null || phone === "") return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const cc = String(
    process.env.GHL_DEFAULT_PHONE_COUNTRY_CODE || defaultCountryCode,
  ).replace(/\D/g, "") || "1";

  if (digits.length === 10) {
    return `+${cc}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith(cc)) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

function mapPaymentServiceError(err) {
  if (err?.code && Object.values(CHECKOUT_ERROR_CODES).includes(err.code)) {
    return err;
  }
  const message = String(err?.message || "");
  if (/E\.164|phone number must be/i.test(message)) {
    return checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 400);
  }
  if (/unauthorized \(401\)|ghl unauthorized|api key/i.test(message)) {
    return checkoutError(CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED, 502);
  }
  if (/contact/i.test(message)) {
    return checkoutError(CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED, 502);
  }
  if (/invoice|checkout url|payments scopes/i.test(message)) {
    return checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
  }
  if (/GHL_|leadconnector|network|timeout|request failed/i.test(message)) {
    return checkoutError(CHECKOUT_ERROR_CODES.GHL_API_FAILED, 502);
  }
  return checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
}

function canProcessGhlPayments() {
  return Boolean(
    isGhlEnabled() &&
      process.env.GHL_API_KEY &&
      String(process.env.GHL_API_KEY).trim() &&
      process.env.GHL_LOCATION_ID &&
      String(process.env.GHL_LOCATION_ID).trim() &&
      hasAllGhlPriceIdsConfigured(),
  );
}

function requirePaymentApiCredentials() {
  if (!isGhlEnabled()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.PAYMENTS_UNAVAILABLE, 503);
  }
  try {
    ghlService.requireContactApiCredentials();
  } catch (err) {
    throw checkoutError(CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED, 502);
  }
  const productId = getGhlProductId();
  if (!productId) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 503);
  }
  return {
    locationId: ghlService.getLocationId(),
    productId,
  };
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysYmd(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Extract a payer-facing checkout / invoice URL from GHL responses.
 */
function extractUrlFromText(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s\]\)"'<>]+/gi) || [];
  if (!matches.length) return null;
  const preferred = matches.find((url) =>
    /\/l\/|invoice|pay|checkout|join\.|msgsndr|leadconnector/i.test(url),
  );
  return (preferred || matches[0] || "").replace(/[.,;]+$/g, "") || null;
}

function extractCheckoutUrl(payload) {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.checkoutUrl,
    payload.paymentUrl,
    payload.invoiceUrl,
    payload.url,
    payload.shareUrl,
    payload.publicUrl,
    payload.link,
    payload.paymentLink,
    payload.invoiceLink,
    payload?.invoice?.checkoutUrl,
    payload?.invoice?.paymentUrl,
    payload?.invoice?.invoiceUrl,
    payload?.invoice?.url,
    payload?.invoice?.shareUrl,
    payload?.invoice?.publicUrl,
    payload?.invoice?.paymentLink,
    payload?.invoice?.invoiceLink,
    payload?.invoice?.meta?.url,
    payload?.invoice?.meta?.paymentUrl,
    payload?.data?.checkoutUrl,
    payload?.data?.paymentUrl,
    payload?.data?.invoiceUrl,
    payload?.data?.url,
    payload?.data?.paymentLink,
    payload?.data?.invoice?.invoiceUrl,
    payload?.data?.invoice?.url,
    payload?.data?.invoice?.paymentLink,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }

  // GHL send-invoice embeds the public pay link in the emailed HTML/text body.
  const fromEmailBody = extractUrlFromText(
    payload?.emailData?.message?.body ||
      payload?.emailData?.body ||
      payload?.message?.body ||
      payload?.body,
  );
  if (fromEmailBody) return fromEmailBody;

  return null;
}

function extractInvoiceId(payload) {
  return (
    payload?._id ||
    payload?.id ||
    payload?.invoiceId ||
    payload?.invoice?._id ||
    payload?.invoice?.id ||
    payload?.data?._id ||
    payload?.data?.id ||
    payload?.data?.invoice?._id ||
    payload?.data?.invoice?.id ||
    null
  );
}

function appendRedirectParams(checkoutUrl, { successUrl, cancelUrl } = {}) {
  if (!checkoutUrl) return checkoutUrl;
  try {
    const url = new URL(checkoutUrl);
    if (successUrl) {
      // GHL FastPay / invoice UIs have used several query names over time.
      url.searchParams.set("redirectUrl", successUrl);
      url.searchParams.set("redirect_url", successUrl);
      url.searchParams.set("successUrl", successUrl);
      if (!url.searchParams.has("redirectIn")) {
        // Seconds before auto-redirect after paid (GHL invoice UI).
        url.searchParams.set("redirectIn", "2");
      }
    }
    if (cancelUrl) {
      url.searchParams.set("cancelUrl", cancelUrl);
      url.searchParams.set("cancel_url", cancelUrl);
    }
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

/**
 * Fetch a single price from GHL Products API.
 * GET /products/:productId/price/:priceId?locationId=
 */
async function getGhlPriceDetails(priceId, productId = getGhlProductId()) {
  const { locationId } = requirePaymentApiCredentials();
  if (!productId) {
    throw Object.assign(new Error("GHL_PRODUCT_ID is required"), {
      statusCode: 500,
    });
  }
  if (!priceId) {
    throw Object.assign(new Error("priceId is required"), { statusCode: 400 });
  }

  const client = createGhlApiClient();
  try {
    const res = await client.get(`/products/${productId}/price/${priceId}`, {
      params: { locationId },
    });
    const price = res.data?.price || res.data?.data || res.data;
    return {
      priceId: price?._id || price?.id || priceId,
      productId: price?.product || price?.productId || productId,
      name: price?.name || null,
      amount:
        typeof price?.amount === "number"
          ? price.amount
          : Number(price?.amount) || null,
      currency: price?.currency || "USD",
      type: price?.type || null,
      recurring: price?.recurring || null,
      raw: price,
    };
  } catch (err) {
    ghlService.sanitizeAxiosError(err);
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * Resolve sender identity for GHL invoice send.
 * GHL requires either userId OR sentFrom ({ fromName, fromEmail }).
 */
async function resolveGhlInvoiceSender(client, locationId) {
  const userId =
    (process.env.GHL_USER_ID && String(process.env.GHL_USER_ID).trim()) || null;
  const fromEmail =
    (process.env.GHL_SENT_FROM_EMAIL &&
      String(process.env.GHL_SENT_FROM_EMAIL).trim()) ||
    (process.env.GHL_SENT_FROM && String(process.env.GHL_SENT_FROM).trim()) ||
    null;
  const fromName =
    (process.env.GHL_SENT_FROM_NAME &&
      String(process.env.GHL_SENT_FROM_NAME).trim()) ||
    (process.env.GHL_BUSINESS_NAME &&
      String(process.env.GHL_BUSINESS_NAME).trim()) ||
    "LendingCart";

  if (userId || fromEmail) {
    return {
      userId,
      sentFrom: fromEmail ? { fromName, fromEmail } : null,
    };
  }

  // Best-effort: pick first location user so send can succeed without extra env.
  try {
    const res = await client.get("/users/", {
      params: { locationId },
    });
    const users = res.data?.users || res.data?.data?.users || res.data?.data || [];
    const first = Array.isArray(users) ? users[0] : null;
    const resolvedUserId = first?.id || first?._id || null;
    const resolvedEmail = first?.email || null;
    if (resolvedUserId || resolvedEmail) {
      return {
        userId: resolvedUserId,
        sentFrom: resolvedEmail
          ? {
              fromName:
                [first.firstName, first.lastName].filter(Boolean).join(" ").trim() ||
                fromName,
              fromEmail: resolvedEmail,
            }
          : null,
      };
    }
  } catch (err) {
    console.warn(
      "GHL resolve invoice sender warning:",
      err.message || err,
    );
  }

  return { userId: null, sentFrom: null };
}

/**
 * Create a draft invoice for a contact + price.
 * POST /invoices/
 */
async function createGhlInvoice({
  contact,
  productId,
  priceId,
  amount,
  currency = "USD",
  itemName,
  itemDescription,
  itemType = "recurring",
  invoiceName,
  liveMode,
} = {}) {
  const { locationId } = requirePaymentApiCredentials();
  const client = createGhlApiClient();
  const resolvedLiveMode = resolveCheckoutLiveMode(liveMode);

  const contactName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.name ||
    contact.email;

  const contactEmail = contact.email
    ? String(contact.email).trim().toLowerCase()
    : null;

  const phoneE164 = toE164Phone(contact.phone);

  const payload = {
    altId: locationId,
    altType: "location",
    name: invoiceName || itemName || "LendingCart Subscription",
    currency,
    liveMode: resolvedLiveMode,
    issueDate: todayYmd(),
    dueDate: addDaysYmd(7),
    title: "INVOICE",
    contactDetails: {
      id: contact.ghlContactId || contact.id,
      name: contactName,
      email: contactEmail,
      ...(phoneE164 ? { phoneNo: phoneE164 } : {}),
      ...(contact.companyName ? { companyName: contact.companyName } : {}),
    },
    items: [
      {
        name: itemName || "Subscription",
        description: itemDescription || undefined,
        productId,
        priceId,
        currency,
        amount: Number(amount),
        qty: 1,
        type: itemType === "one_time" ? "one_time" : "recurring",
        taxInclusive: false,
      },
    ],
    businessDetails: {
      name: process.env.GHL_BUSINESS_NAME || "LendingCart",
    },
  };

  if (contactEmail) {
    payload.sentTo = {
      email: [contactEmail],
      emailCc: [],
      emailBcc: [],
      ...(phoneE164 ? { phoneNo: [phoneE164] } : {}),
    };
  }

  try {
    const res = await client.post("/invoices/", payload);
    return res.data;
  } catch (err) {
    console.error("GHL create invoice:", ghlService.sanitizeAxiosError(err));
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * Send invoice (email + expose payment URL when available).
 * POST /invoices/:invoiceId/send
 * GHL requires either userId or sentFrom.
 * liveMode must match the value used when the invoice was created.
 */
async function sendGhlInvoice(
  invoiceId,
  { email, action = "email", liveMode } = {},
) {
  const { locationId } = requirePaymentApiCredentials();
  if (!invoiceId) {
    throw Object.assign(new Error("invoiceId is required"), { statusCode: 400 });
  }

  const client = createGhlApiClient();
  const sender = await resolveGhlInvoiceSender(client, locationId);
  const resolvedLiveMode = resolveCheckoutLiveMode(liveMode);

  const body = {
    altId: locationId,
    altType: "location",
    action,
    liveMode: resolvedLiveMode,
  };

  if (sender.userId) body.userId = sender.userId;
  if (sender.sentFrom) body.sentFrom = sender.sentFrom;

  if (!body.userId && !body.sentFrom) {
    throw Object.assign(
      new Error(
        "GHL invoice send requires GHL_USER_ID or GHL_SENT_FROM_EMAIL (or a location user)",
      ),
      { statusCode: 503 },
    );
  }

  if (email) {
    body.toEmail = email;
    body.sentTo = { email: [email] };
  }

  try {
    const res = await client.post(`/invoices/${invoiceId}/send`, body);
    return res.data;
  } catch (err) {
    console.error("GHL send invoice:", ghlService.sanitizeAxiosError(err));
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * GET /invoices/:invoiceId?altId=&altType=location
 */
async function getGhlInvoice(invoiceId) {
  const { locationId } = requirePaymentApiCredentials();
  const client = createGhlApiClient();
  try {
    const res = await client.get(`/invoices/${invoiceId}`, {
      params: { altId: locationId, altType: "location" },
    });
    return res.data?.invoice || res.data?.data || res.data;
  } catch (err) {
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * GET /payments/subscriptions/:subscriptionId?altId=&altType=location
 */
async function getGhlSubscription(subscriptionId) {
  const { locationId } = requirePaymentApiCredentials();
  const client = createGhlApiClient();
  try {
    const res = await client.get(
      `/payments/subscriptions/${subscriptionId}`,
      {
        params: { altId: locationId, altType: "location", locationId },
      },
    );
    return res.data?.subscription || res.data?.data || res.data;
  } catch (err) {
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * GET /payments/orders/:orderId?altId=&altType=location
 */
async function getGhlOrder(orderId) {
  const { locationId } = requirePaymentApiCredentials();
  const client = createGhlApiClient();
  try {
    const res = await client.get(`/payments/orders/${orderId}`, {
      params: { altId: locationId, altType: "location", locationId },
    });
    return res.data?.order || res.data?.data || res.data;
  } catch (err) {
    throw ghlService.formatGhlHttpError(err);
  }
}

/**
 * Initialize a recurring subscription checkout for the frontend.
 *
 * Flow:
 *  1) Resolve GHL price ID from packageCode + billingCycle (env)
 *  2) Load price details (amount/currency/type) from Products API
 *  3) Upsert GHL contact (reuse existing contact sync)
 *  4) Create GHL invoice with productId + priceId (recurring)
 *  5) Send invoice / read invoice for checkout URL
 *
 * Returns only frontend-safe fields (never API key).
 */
async function createSubscriptionCheckout(input = {}) {
  try {
    const {
      email,
      firstName,
      lastName,
      phone,
      companyName,
      packageCode,
      billingCycle,
      amount: amountOverride,
      currency: currencyOverride,
      planName,
      successUrl,
      cancelUrl,
      metadata = {},
    } = input;

    if (!email?.trim()) {
      throw checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 400);
    }

    const { productId } = requirePaymentApiCredentials();
    const resolved = resolveGhlPriceId(packageCode, billingCycle);

    let priceDetails = null;
    try {
      priceDetails = await getGhlPriceDetails(resolved.priceId, productId);
    } catch (err) {
      console.warn(
        "GHL price lookup warning:",
        err.message || err,
        `(${resolved.envKey})`,
      );
    }

    const amount =
      amountOverride != null
        ? Number(amountOverride)
        : priceDetails?.amount != null
          ? Number(priceDetails.amount)
          : null;

    if (amount == null || Number.isNaN(amount)) {
      throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 503);
    }

    const currency = currencyOverride || priceDetails?.currency || "USD";
    const itemType =
      priceDetails?.type === "one_time" ? "one_time" : "recurring";

    let contactResult;
    try {
      contactResult = await ghlService.upsertGhlContact({
        email: email.trim().toLowerCase(),
        firstName: firstName || "",
        lastName: lastName || "",
        phone: phone || undefined,
        companyName: companyName || undefined,
        leadSource: "LendingCart Checkout",
        leadType: "Subscription",
        interestedPlan:
          planName ||
          `${resolved.packageCode} ${resolved.billingCycle}`.trim(),
        lendingCartLeadId:
          metadata.lendingCartCheckoutId || metadata.checkoutId || "",
        tags: [
          "lendingcart-checkout",
          `plan-${resolved.packageCode.toLowerCase()}`,
          `cycle-${resolved.billingCycle.toLowerCase()}`,
        ],
      });
    } catch (err) {
      console.error("GHL contact upsert for checkout failed:", err.message);
      throw checkoutError(CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED, 502);
    }

    const ghlContactId = contactResult.ghlContactId;
    if (!ghlContactId) {
      throw checkoutError(CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED, 502);
    }

    const displayName =
      planName ||
      `${resolved.packageCode} ${resolved.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}`;

    // One mode for both create + send (never diverge).
    const liveMode = resolveCheckoutLiveMode();

    let invoicePayload;
    try {
      invoicePayload = await createGhlInvoice({
        contact: {
          ghlContactId,
          email: email.trim().toLowerCase(),
          firstName,
          lastName,
          phone,
          companyName,
        },
        productId,
        priceId: resolved.priceId,
        amount,
        currency,
        itemName: displayName,
        itemDescription: metadata.lendingCartCheckoutId
          ? `LendingCart checkout ${metadata.lendingCartCheckoutId}`
          : "LendingCart subscription",
        itemType,
        invoiceName: `LendingCart — ${displayName}`,
        liveMode,
      });
    } catch (err) {
      console.error("GHL create invoice failed:", err.message);
      throw mapPaymentServiceError(err);
    }

    const invoiceId = extractInvoiceId(invoicePayload);
    let checkoutUrl = extractCheckoutUrl(invoicePayload);

    if (invoiceId) {
      try {
        const sent = await sendGhlInvoice(invoiceId, {
          email: email.trim().toLowerCase(),
          liveMode,
        });
        checkoutUrl = extractCheckoutUrl(sent) || checkoutUrl;
      } catch (err) {
        console.warn("GHL send invoice warning:", err.message || err);
      }

      if (!checkoutUrl) {
        try {
          const invoice = await getGhlInvoice(invoiceId);
          checkoutUrl =
            extractCheckoutUrl(invoice) || extractCheckoutUrl({ invoice });
        } catch (err) {
          console.warn("GHL get invoice warning:", err.message || err);
        }
      }
    }

    if (!checkoutUrl) {
      throw checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
    }

    checkoutUrl = appendRedirectParams(checkoutUrl, { successUrl, cancelUrl });

    return {
      checkoutUrl,
      invoiceId,
      ghlContactId,
      productId,
      priceId: resolved.priceId,
      packageCode: resolved.packageCode,
      billingCycle: resolved.billingCycle,
      amount,
      currency,
      itemType,
    };
  } catch (err) {
    if (err?.code && Object.values(CHECKOUT_ERROR_CODES).includes(err.code)) {
      throw err;
    }
    throw mapPaymentServiceError(err);
  }
}

module.exports = {
  canProcessGhlPayments,
  requirePaymentApiCredentials,
  resolveGhlPriceId,
  getGhlProductId,
  getGhlPriceDetails,
  createGhlInvoice,
  sendGhlInvoice,
  getGhlInvoice,
  getGhlSubscription,
  getGhlOrder,
  createSubscriptionCheckout,
  extractCheckoutUrl,
  resolveCheckoutLiveMode,
  normalizePackageCode,
  normalizeBillingCycle,
  appendRedirectParams,
  toE164Phone,
};
