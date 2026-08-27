/**
 * User-safe error mapping for GHL checkout / payment flows.
 * Raw GHL/API details stay in logs only — never returned to clients.
 */

const CHECKOUT_ERROR_CODES = {
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
    "Some checkout details are invalid. Use a valid phone (10–15 digits) and try again.",
};

function checkoutError(code, statusCode = 400, details) {
  const err = new Error(USER_MESSAGES[code] || USER_MESSAGES.VALIDATION_FAILED);
  err.statusCode = statusCode;
  err.code = code;
  err.expose = true;
  if (details) err.details = details;
  return err;
}

function looksLikeRawGhlError(message) {
  const text = String(message || "");
  return /GHL_|leadconnector|gohighlevel|pit-|Bearer |api key|stack|ECONN|ETIMEDOUT|axios/i.test(
    text,
  );
}

/**
 * Map any thrown error into a safe API response payload.
 */
function toCheckoutErrorResponse(err) {
  if (err?.code && USER_MESSAGES[err.code]) {
    return {
      statusCode: err.statusCode || 400,
      body: {
        success: false,
        code: err.code,
        message: USER_MESSAGES[err.code],
      },
    };
  }

  const message = String(err?.message || "");
  const lower = message.toLowerCase();

  if (/unauthorized \(401\)|ghl unauthorized|api key/i.test(lower)) {
    return {
      statusCode: 502,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED],
      },
    };
  }

  if (err?.statusCode === 401 || /authentication required|please sign in/i.test(message)) {
    return {
      statusCode: 401,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.UNAUTHORIZED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.UNAUTHORIZED],
      },
    };
  }

  if (/missing ghl_.*price|missing .*_price_id|ghl_product_id is required/i.test(message)) {
    return {
      statusCode: 503,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE],
      },
    };
  }

  if (/unsupported billing|billing cycle|billing period/i.test(lower)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD],
      },
    };
  }

  if (/package not found|inactive|unsupported package/i.test(lower)) {
    return {
      statusCode: 404,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.INVALID_PACKAGE,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.INVALID_PACKAGE],
      },
    };
  }

  if (/already have an active/i.test(lower)) {
    return {
      statusCode: 409,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.SUBSCRIPTION_ACTIVE,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_ACTIVE],
      },
    };
  }

  if (/cancelled/i.test(lower) && /subscription/i.test(lower)) {
    return {
      statusCode: 409,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.SUBSCRIPTION_CANCELLED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_CANCELLED],
      },
    };
  }

  if (/expired/i.test(lower) && /subscription/i.test(lower)) {
    return {
      statusCode: 409,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.SUBSCRIPTION_EXPIRED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.SUBSCRIPTION_EXPIRED],
      },
    };
  }

  if (/contact/i.test(lower) && /ghl|upsert|sync/i.test(lower)) {
    return {
      statusCode: 502,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.GHL_CONTACT_FAILED],
      },
    };
  }

  if (/checkout url|invoice was created|create invoice|send invoice/i.test(lower)) {
    return {
      statusCode: 502,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED],
      },
    };
  }

  if (/ghl|payment provider|leadconnector|network|timeout/i.test(lower) || looksLikeRawGhlError(message)) {
    return {
      statusCode: err?.statusCode && err.statusCode >= 400 ? err.statusCode : 502,
      body: {
        success: false,
        code: CHECKOUT_ERROR_CODES.GHL_API_FAILED,
        message: USER_MESSAGES[CHECKOUT_ERROR_CODES.GHL_API_FAILED],
      },
    };
  }

  if (err?.expose && message && !looksLikeRawGhlError(message)) {
    return {
      statusCode: err.statusCode || 400,
      body: {
        success: false,
        code: err.code || CHECKOUT_ERROR_CODES.VALIDATION_FAILED,
        message,
      },
    };
  }

  return {
    statusCode: err?.statusCode && err.statusCode < 500 ? err.statusCode : 500,
    body: {
      success: false,
      code: CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED,
      message: USER_MESSAGES[CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED],
    },
  };
}

module.exports = {
  CHECKOUT_ERROR_CODES,
  USER_MESSAGES,
  checkoutError,
  toCheckoutErrorResponse,
  looksLikeRawGhlError,
};
