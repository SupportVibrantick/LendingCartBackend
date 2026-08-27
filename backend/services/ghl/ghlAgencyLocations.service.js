/**
 * Read-only Agency-level GHL locations (sub-accounts) helpers.
 *
 * Official endpoint: GET /locations/search
 * Auth: Agency Private Integration token (GHL_AGENCY_PRIVATE_TOKEN)
 * Scope required: locations.readonly
 *
 * Does NOT create/update locations.
 * Does NOT touch broker Location OAuth or platform GHL_API_KEY flows.
 */

const {
  createGhlAgencyApiClient,
  isGhlAgencyTokenConfigured,
  sanitizeAgencyAxiosError,
} = require("./ghlAgency.client");

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

function pickString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return null;
}

/**
 * Map a GHL location payload to safe, frontend-safe fields only.
 * Never includes tokens or raw Authorization data.
 */
function toSafeLocationSummary(raw = {}) {
  const locationId = pickString(raw.id, raw.locationId, raw._id);
  const companyId = pickString(raw.companyId, raw.company_id, raw.company?.id);
  const address =
    pickString(raw.address, raw.address1, raw.street) ||
    (raw.address && typeof raw.address === "object"
      ? pickString(raw.address.addressLine1, raw.address.line1)
      : null);

  return {
    locationId,
    name: pickString(raw.name, raw.businessName, raw.companyName),
    address,
    city: pickString(raw.city, raw.address?.city),
    state: pickString(raw.state, raw.address?.state),
    country: pickString(raw.country, raw.address?.country),
    postalCode: pickString(
      raw.postalCode,
      raw.zip,
      raw.zipCode,
      raw.address?.postalCode,
    ),
    companyId,
  };
}

function extractLocationsArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.locations)) return data.locations;
  if (Array.isArray(data.data?.locations)) return data.data.locations;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function isCompanyIdRequiredError(sanitized) {
  const blob = JSON.stringify(sanitized?.data || {}).toLowerCase();
  const message = String(sanitized?.message || "").toLowerCase();
  const combined = `${message} ${blob}`;
  return (
    /companyid|company id|agency id|company\/agency/.test(combined) &&
    /required|missing|must/.test(combined)
  );
}

/**
 * List agency sub-accounts via GET /locations/search.
 *
 * Official docs mark `companyId` as an optional query filter for Agency tokens.
 * This function does NOT invent a companyId. If the API rejects the call because
 * companyId is required, returns `{ ok: false, code: "COMPANY_ID_REQUIRED", ... }`.
 *
 * @param {{ limit?: number, skip?: number, companyId?: string|null }} [options]
 * @returns {Promise<object>} Safe summary — never includes the private token.
 */
async function listAgencyLocations(options = {}) {
  if (!isGhlAgencyTokenConfigured()) {
    return {
      ok: false,
      code: "AGENCY_TOKEN_MISSING",
      message:
        "GHL_AGENCY_PRIVATE_TOKEN is not set. Configure the Agency Private Integration token in backend env.",
      locations: [],
      meta: {
        endpoint: "GET /locations/search",
        companyIdUsed: null,
        scopesExpected: ["locations.readonly"],
      },
    };
  }

  const limitRaw = Number(options.limit);
  const skipRaw = Number(options.skip);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const skip =
    Number.isFinite(skipRaw) && skipRaw >= 0 ? Math.floor(skipRaw) : 0;

  // Only pass companyId when explicitly provided — never invent one.
  const companyId =
    options.companyId != null && String(options.companyId).trim()
      ? String(options.companyId).trim()
      : null;

  const params = {
    limit: String(limit),
    skip: String(skip),
    order: "asc",
  };
  if (companyId) {
    params.companyId = companyId;
  }

  const client = createGhlAgencyApiClient();

  try {
    const res = await client.get("/locations/search", { params });
    const rawLocations = extractLocationsArray(res.data);
    const locations = rawLocations
      .map(toSafeLocationSummary)
      .filter((loc) => Boolean(loc.locationId));

    const inferredCompanyId =
      companyId ||
      locations.find((loc) => loc.companyId)?.companyId ||
      null;

    return {
      ok: true,
      code: "OK",
      message: `Retrieved ${locations.length} location(s)`,
      locations,
      meta: {
        endpoint: "GET /locations/search",
        companyIdUsed: companyId,
        companyIdInferredFromResults: inferredCompanyId,
        count: locations.length,
        limit,
        skip,
        scopesExpected: ["locations.readonly"],
        // Confirm write scope was NOT used for this read-only call.
        writePerformed: false,
      },
    };
  } catch (err) {
    const sanitized = sanitizeAgencyAxiosError(err);

    if (isCompanyIdRequiredError(sanitized)) {
      return {
        ok: false,
        code: "COMPANY_ID_REQUIRED",
        message:
          "HighLevel rejected the request because a companyId (Agency ID) is required. " +
          "Provide the Agency/company ID explicitly (do not invent it). " +
          "Sources: GHL Agency Settings UI, or companyId returned after a Location OAuth connect (OrganizationGhlConnection.ghlCompanyId).",
        locations: [],
        meta: {
          endpoint: "GET /locations/search",
          companyIdUsed: null,
          status: sanitized.status,
          providerMessage:
            sanitized.data?.message ||
            sanitized.data?.msg ||
            sanitized.data?.error ||
            sanitized.message,
          scopesExpected: ["locations.readonly"],
        },
      };
    }

    return {
      ok: false,
      code: "AGENCY_LOCATIONS_LIST_FAILED",
      message:
        sanitized.data?.message ||
        sanitized.data?.msg ||
        sanitized.data?.error ||
        sanitized.message ||
        "Failed to list Agency locations",
      locations: [],
      meta: {
        endpoint: "GET /locations/search",
        companyIdUsed: companyId,
        status: sanitized.status,
        providerCode: sanitized.code,
        // Safe provider body for debugging (no Authorization header).
        providerData: sanitized.data,
        scopesExpected: ["locations.readonly", "locations.write"],
        note: "locations.write is not used by this read-only test; locations.readonly is required.",
      },
    };
  }
}

module.exports = {
  listAgencyLocations,
  toSafeLocationSummary,
  isCompanyIdRequiredError,
};
