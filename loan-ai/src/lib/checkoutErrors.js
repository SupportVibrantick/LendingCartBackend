/**
 * User-facing checkout / subscription error messages.
 * Never display raw payment-provider (GHL) API text to users.
 */

export const CHECKOUT_ERROR_CODES = {
  INVALID_PACKAGE: "INVALID_PACKAGE",
  INVALID_BILLING_PERIOD: "INVALID_BILLING_PERIOD",
  MISSING_GHL_PRICE: "MISSING_GHL_PRICE",
  GHL_AUTH_FAILED: "GHL_AUTH_FAILED",
  GHL_API_FAILED: "GHL_API_FAILED",
  GHL_CONTACT_FAILED: "GHL_CONTACT_FAILED",
  CHECKOUT_CREATE_FAILED: "CHECKOUT_CREATE_FAILED",
  WEBHOOK_FAILED: "WEBHOOK_FAILED",
  DUPLICATE_WEBHOOK: "DUPLICATE_WEBHOOK",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  SUBSCRIPTION_ACTIVE: "SUBSCRIPTION_ACTIVE",
  PAYMENTS_UNAVAILABLE: "PAYMENTS_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
};

const USER_MESSAGES = {
  [CHECKOUT_ERROR_CODES.INVALID_PACKAGE]:
    "That subscription package is unavailable. Please refresh and choose another plan.",
  [CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD]:
    "Please choose a valid billing period (monthly or yearly).",
  [CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE]:
    "This plan is not available for checkout right now. Please contact support.",
  [CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED]:
    "Payment service authentication failed. Please try again later or contact support.",
  [CHECKOUT_ERROR_CODES.GHL_API_FAILED]:
    "We couldn't reach the payment provider. Please try again in a moment.",
  [CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED]:
    "We couldn't prepare your payment profile. Please try again.",
  [CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED]:
    "We couldn't start checkout. Please try again.",
  [CHECKOUT_ERROR_CODES.WEBHOOK_FAILED]:
    "Payment confirmation failed to process. If you were charged, contact support.",
  [CHECKOUT_ERROR_CODES.DUPLICATE_WEBHOOK]:
    "This payment event was already processed.",
  [CHECKOUT_ERROR_CODES.SUBSCRIPTION_EXPIRED]:
    "Your previous subscription has expired. Choose a plan to renew.",
  [CHECKOUT_ERROR_CODES.SUBSCRIPTION_CANCELLED]:
    "Your subscription was cancelled. Choose a plan to subscribe again.",
  [CHECKOUT_ERROR_CODES.SUBSCRIPTION_ACTIVE]:
    "You already have an active subscription.",
  [CHECKOUT_ERROR_CODES.PAYMENTS_UNAVAILABLE]:
    "Online checkout is temporarily unavailable. Please try again later.",
  [CHECKOUT_ERROR_CODES.RATE_LIMITED]:
    "Too many attempts. Please wait a moment and try again.",
  [CHECKOUT_ERROR_CODES.UNAUTHORIZED]:
    "Please sign in to continue to checkout.",
  [CHECKOUT_ERROR_CODES.VALIDATION_FAILED]:
    "Some checkout details are invalid. Please refresh and try again.",
};

function looksLikeRawProviderError(message) {
  return /GHL_|leadconnector|gohighlevel|pit-|Bearer |api key|stack|ECONN|ETIMEDOUT|axios|invoice was created|status code/i.test(
    String(message || ""),
  );
}

/**
 * Map API / thrown errors to a safe user-facing string.
 * @param {unknown} err
 * @returns {string}
 */
export function getCheckoutUserMessage(err) {
  if (!err) {
    return USER_MESSAGES[CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED];
  }

  const code = err.code || err?.body?.code;
  if (code && USER_MESSAGES[code]) {
    return USER_MESSAGES[code];
  }

  const message = String(err.message || err?.body?.message || "").trim();
  if (message && !looksLikeRawProviderError(message)) {
    // Prefer known phrases from our API
    const lower = message.toLowerCase();
    if (/already have an active/.test(lower)) {
      return USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_ACTIVE];
    }
    if (/expired/.test(lower) && /subscription/.test(lower)) {
      return USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_EXPIRED];
    }
    if (/cancelled|canceled/.test(lower) && /subscription/.test(lower)) {
      return USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_CANCELLED];
    }
    if (/too many/.test(lower)) {
      return USER_MESSAGES[CHECKOUT_ERROR_CODES.RATE_LIMITED];
    }
    // Do not rewrite unrelated "sign in" copy (e.g. broker account messages)
    if (
      /please sign in to continue|authentication required|^unauthorized$/i.test(
        lower,
      )
    ) {
      return USER_MESSAGES[CHECKOUT_ERROR_CODES.UNAUTHORIZED];
    }
    return message;
  }

  return USER_MESSAGES[CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED];
}

export class CheckoutRequestError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = "CheckoutRequestError";
    this.code = code;
    this.status = status;
  }
}
