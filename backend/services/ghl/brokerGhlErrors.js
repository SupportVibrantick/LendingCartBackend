const BROKER_GHL_ERROR_CODES = {
  NOT_CONNECTED: "BROKER_GHL_NOT_CONNECTED",
  CONNECTION_INACTIVE: "BROKER_GHL_CONNECTION_INACTIVE",
  CONNECTION_ERROR: "BROKER_GHL_CONNECTION_ERROR",
  TOKEN_EXPIRED: "BROKER_GHL_TOKEN_EXPIRED",
  TOKEN_REFRESH_FAILED: "BROKER_GHL_TOKEN_REFRESH_FAILED",
  ORG_ISOLATION: "BROKER_GHL_ORG_ISOLATION",
  VALIDATION_FAILED: "BROKER_GHL_VALIDATION_FAILED",
  NOT_FOUND: "BROKER_GHL_NOT_FOUND",
  RATE_LIMITED: "BROKER_GHL_RATE_LIMITED",
  FORBIDDEN: "BROKER_GHL_FORBIDDEN",
  API_FAILED: "BROKER_GHL_API_FAILED",
  CONTACT_FAILED: "BROKER_GHL_CONTACT_FAILED",
};

const USER_MESSAGES = {
  [BROKER_GHL_ERROR_CODES.NOT_CONNECTED]:
    "GoHighLevel is not connected for this broker organization",
  [BROKER_GHL_ERROR_CODES.CONNECTION_INACTIVE]:
    "GoHighLevel connection is inactive. Reconnect to continue.",
  [BROKER_GHL_ERROR_CODES.CONNECTION_ERROR]:
    "GoHighLevel connection needs attention. Reconnect to continue.",
  [BROKER_GHL_ERROR_CODES.TOKEN_EXPIRED]:
    "GoHighLevel session expired. Reconnect to continue.",
  [BROKER_GHL_ERROR_CODES.TOKEN_REFRESH_FAILED]:
    "GoHighLevel session could not be refreshed. Reconnect to continue.",
  [BROKER_GHL_ERROR_CODES.RATE_LIMITED]:
    "GoHighLevel rate limit reached. Please try again shortly.",
  [BROKER_GHL_ERROR_CODES.FORBIDDEN]:
    "GoHighLevel denied this request. Check your connection permissions.",
  [BROKER_GHL_ERROR_CODES.NOT_FOUND]: "GoHighLevel resource not found",
  [BROKER_GHL_ERROR_CODES.API_FAILED]:
    "GoHighLevel request failed. Please try again.",
  [BROKER_GHL_ERROR_CODES.CONTACT_FAILED]:
    "GoHighLevel contact request failed. Please try again.",
};

class BrokerGhlError extends Error {
  constructor(code, message, { statusCode = 502, cause } = {}) {
    super(message || USER_MESSAGES[code] || "GoHighLevel request failed");
    this.name = "BrokerGhlError";
    this.code = code;
    this.statusCode = statusCode;
    if (cause) this.cause = cause;
  }
}

function brokerGhlError(code, statusCode = 502) {
  return new BrokerGhlError(code, USER_MESSAGES[code], { statusCode });
}

function toBrokerGhlErrorResponse(err) {
  if (err instanceof BrokerGhlError) {
    return {
      statusCode: err.statusCode,
      body: {
        success: false,
        code: err.code,
        message: err.message,
      },
    };
  }
  return {
    statusCode: 502,
    body: {
      success: false,
      code: BROKER_GHL_ERROR_CODES.API_FAILED,
      message: USER_MESSAGES[BROKER_GHL_ERROR_CODES.API_FAILED],
    },
  };
}

function sanitizeProviderMessage(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  if (
    /access_token|refresh_token|Bearer\s|GHL_API_KEY|client_secret|enc:v1:/i.test(
      value,
    )
  ) {
    return null;
  }
  return value.length > 500 ? `${value.slice(0, 500)}…` : value;
}

module.exports = {
  BROKER_GHL_ERROR_CODES,
  USER_MESSAGES,
  BrokerGhlError,
  brokerGhlError,
  toBrokerGhlErrorResponse,
  sanitizeProviderMessage,
};
