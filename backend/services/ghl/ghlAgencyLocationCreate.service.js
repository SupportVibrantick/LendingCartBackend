/**
 * Agency GHL sub-account (location) CREATE.
 *
 * Official: POST /locations/
 * https://marketplace.gohighlevel.com/docs/ghl/locations/create-location/
 *
 * Auth: Agency Private Integration (GHL_AGENCY_PRIVATE_TOKEN)
 * Scope: locations.write
 *
 * Isolated from broker Location OAuth and platform GHL_API_KEY.
 * Never logs Authorization headers or token values.
 */

const {
  createGhlAgencyApiClient,
  isGhlAgencyTokenConfigured,
  sanitizeAgencyAxiosError,
} = require("./ghlAgency.client");
const { GhlAccountLocationError } = require("./ghlAccountLocation.service");

const CREATE_TIMEOUT_MS = 60000;

function pickString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return null;
}

function redactSecrets(text) {
  return String(text || "")
    .slice(0, 500)
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(
      /GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+/gi,
      "GHL_AGENCY_PRIVATE_TOKEN=[REDACTED]",
    )
    .replace(/\bpit-[A-Za-z0-9]+\b/gi, "[REDACTED]");
}

function extractCreatedLocation(data) {
  const raw = data?.location || data?.data || data || {};
  return {
    locationId: pickString(raw.id, raw.locationId, raw._id, data?.id),
    companyId: pickString(raw.companyId, raw.company_id, data?.companyId),
    name: pickString(raw.name, data?.name),
  };
}

function toCreateError(err) {
  const sanitized = err?.response
    ? sanitizeAgencyAxiosError(err)
    : { message: String(err?.message || err || "Agency location create failed") };
  let raw =
    sanitized.data?.message ||
    sanitized.data?.msg ||
    sanitized.data?.error ||
    sanitized.message ||
    "Agency location create failed";
  if (Array.isArray(raw)) {
    raw = raw.filter(Boolean).join(", ");
  }
  let message = redactSecrets(raw);
  let code = "AGENCY_LOCATION_CREATE_FAILED";

  if (
    /aren'?t allowed to create new locations|upgrade your base plan|location limit|sub-account limit/i.test(
      message,
    )
  ) {
    code = "AGENCY_LOCATION_QUOTA_EXCEEDED";
    message =
      "Agency CRM location limit reached. Upgrade the GoHighLevel agency plan or free a sub-account, then retry setup.";
  }

  const status = sanitized.status || err.statusCode || 502;
  return new GhlAccountLocationError(message, {
    code,
    statusCode: status >= 400 && status < 600 ? status : 502,
  });
}

/**
 * Create a dedicated Agency sub-account under companyId.
 *
 * Required GHL body: name, companyId.
 * Optional snapshotId applies a Pro/Elite Account Snapshot at create time.
 *
 * @param {{
 *   name: string,
 *   companyId: string,
 *   snapshotId?: string|null,
 *   phone?: string|null,
 *   email?: string|null,
 *   client?: object|null,
 * }} args
 * @returns {Promise<{ locationId: string, companyId: string|null, name: string|null, snapshotId: string|null }>}
 */
async function createAgencyLocation({
  name,
  companyId,
  snapshotId = null,
  phone = null,
  email = null,
  firstName = null,
  lastName = null,
  client = null,
} = {}) {
  if (!isGhlAgencyTokenConfigured() && !client) {
    throw new GhlAccountLocationError(
      "GHL_AGENCY_PRIVATE_TOKEN is required to create Agency sub-accounts",
      { code: "MISSING_GHL_AGENCY_PRIVATE_TOKEN", statusCode: 503 },
    );
  }

  const locationName = pickString(name);
  const agencyCompanyId = pickString(companyId);
  if (!locationName) {
    throw new GhlAccountLocationError("Location name is required", {
      code: "MISSING_LOCATION_NAME",
      statusCode: 400,
    });
  }
  if (!agencyCompanyId) {
    throw new GhlAccountLocationError("companyId is required", {
      code: "MISSING_GHL_AGENCY_COMPANY_ID",
      statusCode: 400,
    });
  }

  const payload = {
    name: locationName.slice(0, 120),
    companyId: agencyCompanyId,
  };
  const snap = pickString(snapshotId);
  if (snap) payload.snapshotId = snap;
  const phoneVal = pickString(phone);
  if (phoneVal) payload.phone = phoneVal;

  // GHL Create Location requires prospectInfo.firstName + lastName as strings
  // whenever prospectInfo is present (email alone is rejected).
  const prospectFirst =
    pickString(firstName) ||
    pickString(locationName.split(/\s+/)[0]) ||
    "Broker";
  const prospectLast =
    pickString(lastName) ||
    pickString(locationName.split(/\s+/).slice(1).join(" ")) ||
    "Admin";
  const emailVal = pickString(email);
  payload.prospectInfo = {
    firstName: prospectFirst.slice(0, 50),
    lastName: prospectLast.slice(0, 50),
    ...(emailVal ? { email: emailVal } : {}),
  };

  const api = client || createGhlAgencyApiClient({ timeoutMs: CREATE_TIMEOUT_MS });

  try {
    const res = await api.post("/locations/", payload);
    const created = extractCreatedLocation(res.data);
    if (!created.locationId) {
      throw new GhlAccountLocationError(
        "GHL Create Location succeeded but response had no location id",
        { code: "AGENCY_LOCATION_CREATE_NO_ID", statusCode: 502 },
      );
    }
    return {
      locationId: created.locationId,
      companyId: created.companyId || agencyCompanyId,
      name: created.name || locationName,
      snapshotId: snap || null,
    };
  } catch (err) {
    if (err instanceof GhlAccountLocationError) throw err;
    throw toCreateError(err);
  }
}

module.exports = {
  CREATE_TIMEOUT_MS,
  extractCreatedLocation,
  createAgencyLocation,
  redactSecrets,
};
