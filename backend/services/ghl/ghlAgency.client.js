/**
 * Agency-level GHL API client (Private Integration).
 *
 * Isolated from:
 * - platform Location PIT (`GHL_API_KEY` / modules/ghl/ghl.client.js)
 * - broker Location OAuth (brokerGhlClient.service.js)
 *
 * Never log Authorization headers or token values.
 */

const axios = require("axios");

const GHL_API_BASE =
  process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";
const GHL_API_VERSION = process.env.GHL_API_VERSION || "2021-07-28";
const REQUEST_TIMEOUT_MS = 15000;

function getAgencyPrivateToken() {
  const token = process.env.GHL_AGENCY_PRIVATE_TOKEN;
  if (!token || !String(token).trim()) {
    throw new Error(
      "GHL_AGENCY_PRIVATE_TOKEN is required for Agency-level GHL API calls",
    );
  }
  return String(token).trim();
}

function isGhlAgencyTokenConfigured() {
  return Boolean(
    process.env.GHL_AGENCY_PRIVATE_TOKEN &&
      String(process.env.GHL_AGENCY_PRIVATE_TOKEN).trim(),
  );
}

/**
 * Axios client authenticated with the Agency Private Integration token.
 * Does not use GHL_API_KEY or broker OAuth tokens.
 */
/**
 * Axios client authenticated with the Agency Private Integration token.
 * Does not use GHL_API_KEY or broker OAuth tokens.
 *
 * @param {{ timeoutMs?: number }} [options]
 */
function createGhlAgencyApiClient(options = {}) {
  const token = getAgencyPrivateToken();
  const timeoutMs =
    Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : REQUEST_TIMEOUT_MS;

  return axios.create({
    baseURL: GHL_API_BASE,
    timeout: timeoutMs,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: GHL_API_VERSION,
      Accept: "application/json",
    },
  });
}

/**
 * Safe error summary — strips Authorization / token-like strings.
 */
function sanitizeAgencyAxiosError(err) {
  const status = err.response?.status || null;
  const data = err.response?.data ?? null;
  const message = String(err.message || "GHL Agency request failed");

  return {
    message: message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]"),
    code: err.code || null,
    status,
    data,
  };
}

module.exports = {
  GHL_API_BASE,
  GHL_API_VERSION,
  createGhlAgencyApiClient,
  getAgencyPrivateToken,
  isGhlAgencyTokenConfigured,
  sanitizeAgencyAxiosError,
};
