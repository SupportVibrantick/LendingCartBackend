/**
 * Agency GHL config helpers (company ID, optional snapshots, legacy pool IDs).
 *
 * Dedicated per-org locations are created via POST /locations/ — do not map
 * organizations onto GHL_PRO_LOCATION_ID / GHL_ELITE_LOCATION_ID pools.
 * Those env vars are legacy shared-pool IDs used only to detect old mappings.
 *
 * Server-only; do not expose GHL_AGENCY_PRIVATE_TOKEN or wire this into frontend.
 *
 * Supported plans: PRO, ELITE
 */

const LOCATION_ENV_BY_PLAN = Object.freeze({
  PRO: "GHL_PRO_LOCATION_ID",
  ELITE: "GHL_ELITE_LOCATION_ID",
});

/** Optional Account Snapshot IDs applied when creating a dedicated sub-account. */
const SNAPSHOT_ENV_BY_PLAN = Object.freeze({
  PRO: "GHL_PRO_SNAPSHOT_ID",
  ELITE: "GHL_ELITE_SNAPSHOT_ID",
});

const DEFAULT_AGENCY_APP_BASE_URL = "https://app.gohighlevel.com";

const SUPPORTED_ACCOUNT_PLANS = Object.freeze(
  Object.keys(LOCATION_ENV_BY_PLAN),
);

class GhlAccountLocationError extends Error {
  constructor(message, { code = "GHL_ACCOUNT_LOCATION_ERROR", statusCode = 400 } = {}) {
    super(message);
    this.name = "GhlAccountLocationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Normalize plan / package labels to PRO | ELITE | null.
 * Accepts common variants ("pro", "PRO", "Pro Account") — never infers from locationId.
 */
function normalizeAccountPlan(plan) {
  const raw = String(plan || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!raw) return null;

  if (raw === "PRO" || raw === "PRO_ACCOUNT" || raw === "PACKAGE_PRO") {
    return "PRO";
  }
  if (raw === "ELITE" || raw === "ELITE_ACCOUNT" || raw === "PACKAGE_ELITE") {
    return "ELITE";
  }

  // Reject anything else (including BASIC) — no silent remap.
  if (LOCATION_ENV_BY_PLAN[raw]) return raw;
  return null;
}

function readRequiredEnv(envKey, { missingCode }) {
  const value = process.env[envKey];
  if (!value || !String(value).trim()) {
    throw new GhlAccountLocationError(
      `Missing required environment variable: ${envKey}`,
      { code: missingCode, statusCode: 503 },
    );
  }
  return String(value).trim();
}

function getAgencyCompanyId() {
  return readRequiredEnv("GHL_AGENCY_COMPANY_ID", {
    missingCode: "MISSING_GHL_AGENCY_COMPANY_ID",
  });
}

function getProLocationId() {
  return readRequiredEnv("GHL_PRO_LOCATION_ID", {
    missingCode: "MISSING_GHL_PRO_LOCATION_ID",
  });
}

function getEliteLocationId() {
  return readRequiredEnv("GHL_ELITE_LOCATION_ID", {
    missingCode: "MISSING_GHL_ELITE_LOCATION_ID",
  });
}

/**
 * Resolve the GHL location ID for a subscription plan.
 * @param {string} plan e.g. PRO | ELITE | "Pro Account"
 * @returns {{ plan: 'PRO'|'ELITE', locationId: string, envKey: string }}
 */
function getLocationIdForPlan(plan) {
  const normalized = normalizeAccountPlan(plan);
  if (!normalized) {
    throw new GhlAccountLocationError(
      `Unsupported plan for GHL account location: ${String(plan || "").trim() || "(empty)"}. ` +
        `Supported plans: ${SUPPORTED_ACCOUNT_PLANS.join(", ")}.`,
      { code: "UNSUPPORTED_ACCOUNT_PLAN", statusCode: 400 },
    );
  }

  const envKey = LOCATION_ENV_BY_PLAN[normalized];
  const locationId = readRequiredEnv(envKey, {
    missingCode: `MISSING_${envKey}`,
  });

  return {
    plan: normalized,
    locationId,
    envKey,
  };
}

function hasAccountLocationsConfigured() {
  return SUPPORTED_ACCOUNT_PLANS.every((plan) => {
    const key = LOCATION_ENV_BY_PLAN[plan];
    const value = process.env[key];
    return Boolean(value && String(value).trim());
  });
}

function readOptionalEnv(envKey) {
  const value = process.env[envKey];
  if (!value || !String(value).trim()) return null;
  return String(value).trim();
}

/**
 * Optional snapshot for a plan. Missing snapshot is allowed — location is still created.
 * @returns {{ plan: 'PRO'|'ELITE', snapshotId: string|null, envKey: string }}
 */
function getOptionalSnapshotIdForPlan(plan) {
  const normalized = normalizeAccountPlan(plan);
  if (!normalized) {
    throw new GhlAccountLocationError(
      `Unsupported plan for GHL snapshot: ${String(plan || "").trim() || "(empty)"}. ` +
        `Supported plans: ${SUPPORTED_ACCOUNT_PLANS.join(", ")}.`,
      { code: "UNSUPPORTED_ACCOUNT_PLAN", statusCode: 400 },
    );
  }
  const envKey = SNAPSHOT_ENV_BY_PLAN[normalized];
  return {
    plan: normalized,
    snapshotId: readOptionalEnv(envKey),
    envKey,
  };
}

/**
 * Location IDs that are the legacy shared Pro/Elite pools — never reuse as a
 * dedicated per-org CRM. Empty env values are ignored.
 */
function getSharedPoolLocationIds() {
  const ids = new Set();
  for (const envKey of Object.values(LOCATION_ENV_BY_PLAN)) {
    const value = readOptionalEnv(envKey);
    if (value) ids.add(value);
  }
  return ids;
}

function isSharedPoolLocationId(locationId) {
  const id = String(locationId || "").trim();
  if (!id) return false;
  return getSharedPoolLocationIds().has(id);
}

function getAgencyAppBaseUrl() {
  return (
    readOptionalEnv("GHL_AGENCY_APP_BASE_URL") || DEFAULT_AGENCY_APP_BASE_URL
  ).replace(/\/+$/, "");
}

/**
 * White-label (or default GHL) dashboard URL for a sub-account.
 * Example: https://app.commerciallendingmastery.com/v2/location/{id}/dashboard
 */
function buildAgencyLocationDashboardUrl(locationId) {
  const id = String(locationId || "").trim();
  if (!id) return null;
  return `${getAgencyAppBaseUrl()}/v2/location/${encodeURIComponent(id)}/dashboard`;
}

function buildAgencyAppLoginUrl() {
  return getAgencyAppBaseUrl();
}

module.exports = {
  LOCATION_ENV_BY_PLAN,
  SNAPSHOT_ENV_BY_PLAN,
  SUPPORTED_ACCOUNT_PLANS,
  DEFAULT_AGENCY_APP_BASE_URL,
  GhlAccountLocationError,
  normalizeAccountPlan,
  getAgencyCompanyId,
  getProLocationId,
  getEliteLocationId,
  getLocationIdForPlan,
  hasAccountLocationsConfigured,
  getOptionalSnapshotIdForPlan,
  getSharedPoolLocationIds,
  isSharedPoolLocationId,
  getAgencyAppBaseUrl,
  buildAgencyLocationDashboardUrl,
  buildAgencyAppLoginUrl,
};
