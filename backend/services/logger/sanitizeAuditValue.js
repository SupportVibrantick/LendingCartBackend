/**
 * Redact secrets from audit log old/new value payloads.
 * Applied on write and on read so historical rows are safe in the admin UI.
 */

const { getAuditLogPayloadMaxBytes } = require("../../config/env");

const SENSITIVE_KEY_PATTERN =
  /password|passwd|passwordhash|hashedpassword|secret|token|bearer|authorization|api[_-]?key|private[_-]?key|refresh|jwt|session|otp|pin|ssn|cvv|cvc/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAuditValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 8) return "[TRUNCATED]";

  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…[TRUNCATED]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeAuditValue(nested, depth + 1);
  }
  return out;
}

function truncateJsonString(json, maxBytes = getAuditLogPayloadMaxBytes()) {
  if (json == null) return json;
  const str = String(json);
  if (Buffer.byteLength(str, "utf8") <= maxBytes) {
    return str;
  }
  // Keep valid-ish truncated JSON marker rather than a huge payload.
  const sliced = Buffer.from(str, "utf8").subarray(0, maxBytes).toString("utf8");
  return `${sliced}…[TRUNCATED]`;
}

function sanitizeAuditValueJson(raw) {
  if (raw == null || raw === "") return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return truncateJsonString(JSON.stringify(sanitizeAuditValue(parsed)));
  } catch {
    return truncateJsonString(raw);
  }
}

module.exports = {
  sanitizeAuditValue,
  sanitizeAuditValueJson,
  truncateJsonString,
};
