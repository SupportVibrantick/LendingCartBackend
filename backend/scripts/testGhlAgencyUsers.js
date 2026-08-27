/**
 * READ-ONLY spike: can Agency Private Integration list GHL team users
 * for the fixed Pro location?
 *
 * Usage (from backend/):
 *   node scripts/testGhlAgencyUsers.js
 *   node scripts/testGhlAgencyUsers.js --locationId=RQ3JZOrCXQUaIXK4FmYc
 *
 * Safe fields only. Never prints tokens.
 * Does NOT create/update/invite/delete users.
 */
require("dotenv").config();

const {
  createGhlAgencyApiClient,
  isGhlAgencyTokenConfigured,
  GHL_API_BASE,
  GHL_API_VERSION,
  sanitizeAgencyAxiosError,
} = require("../services/ghl/ghlAgency.client");

const DEFAULT_PRO_LOCATION_ID = "RQ3JZOrCXQUaIXK4FmYc";

function parseArgs(argv) {
  const out = { locationId: DEFAULT_PRO_LOCATION_ID };
  for (const arg of argv) {
    if (arg.startsWith("--locationId=")) {
      out.locationId = arg.slice("--locationId=".length).trim() || DEFAULT_PRO_LOCATION_ID;
    }
  }
  return out;
}

function pickString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return null;
}

function extractUsers(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.data?.users)) return data.data.users;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function toSafeUser(raw = {}, fallbackLocationId) {
  const first = pickString(raw.firstName, raw.first_name);
  const last = pickString(raw.lastName, raw.last_name);
  const name =
    pickString(raw.name) ||
    [first, last].filter(Boolean).join(" ").trim() ||
    null;

  let role = null;
  if (typeof raw.role === "string") role = raw.role;
  else if (raw.roles && typeof raw.roles === "object") {
    role =
      pickString(raw.roles.type, raw.roles.role, raw.roles.name) ||
      (Array.isArray(raw.roles) ? raw.roles.map(String).join(",") : null);
  } else if (Array.isArray(raw.roles)) {
    role = raw.roles.map((r) => (typeof r === "string" ? r : r?.name || r?.type)).join(",");
  }

  let status = null;
  if (raw.deleted === true) status = "deleted";
  else if (raw.deleted === false) status = "active";
  else status = pickString(raw.status, raw.userStatus);

  const locationIds = Array.isArray(raw.locationIds)
    ? raw.locationIds
    : Array.isArray(raw.locations)
      ? raw.locations.map((l) => (typeof l === "string" ? l : l?.id)).filter(Boolean)
      : null;

  return {
    userId: pickString(raw.id, raw.userId, raw._id),
    name,
    email: pickString(raw.email),
    role,
    locationId: pickString(
      raw.locationId,
      locationIds?.[0],
      fallbackLocationId,
    ),
    status,
  };
}

function looksLikeSecretLeak(text) {
  return /GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+/i.test(
    text,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const locationId = args.locationId;

  console.log("GHL AGENCY USERS SPIKE (READ-ONLY)");
  console.log("=================================");
  console.log({
    tokenConfigured: isGhlAgencyTokenConfigured(),
    apiBase: GHL_API_BASE,
    apiVersion: GHL_API_VERSION,
    locationId,
    endpoint: "GET /users/search",
    writePerformed: false,
  });
  console.log("");
  console.log("Distinction:");
  console.log("  GHL Location     = sub-account (Pro/Elite pool)");
  console.log("  GHL Team User    = login user inside a location (THIS TEST)");
  console.log("  GHL CRM Contact  = lead/contact record (NOT this test)");
  console.log("");

  if (!isGhlAgencyTokenConfigured()) {
    console.error("FAIL: GHL_AGENCY_PRIVATE_TOKEN is not configured");
    process.exitCode = 1;
    return;
  }

  const client = createGhlAgencyApiClient();

  try {
    const res = await client.get("/users/search", {
      params: {
        locationId,
        companyId: process.env.GHL_AGENCY_COMPANY_ID,

      },
    });

    const users = extractUsers(res.data).map((u) => toSafeUser(u, locationId));
    const payload = {
      ok: true,
      httpStatus: res.status,
      count: users.length,
      users,
      note: "Listed team users only — no writes performed",
    };

    const serialized = JSON.stringify(payload, null, 2);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log(serialized);
    console.log("");
    console.log(`OK — Agency PI listed ${users.length} team user(s) for location.`);
  } catch (err) {
    const sanitized = sanitizeAgencyAxiosError(err);
    const providerMessage =
      sanitized.data?.message ||
      sanitized.data?.msg ||
      sanitized.data?.error ||
      sanitized.message;

      const result = {
        ok: false,
        httpStatus: sanitized.status,
        providerCode: sanitized.code,
        providerMessage,
        providerData: sanitized.data,
        endpoint: "GET /users/search",
        locationId,
        companyId: process.env.GHL_AGENCY_COMPANY_ID || null,
        scopesConfiguredForTest: [
          "locations.readonly",
          "locations.write",
          "users.readonly",
        ],
        writePerformed: false,
      };

    const serialized = JSON.stringify(result, null, 2);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log(serialized);
    console.log("");
    console.error("FAIL — Agency PI could not list team users for this location.");
    if (sanitized.status === 401 || sanitized.status === 403) {
      console.error(
        "Likely missing scope: users.readonly (Agency Private Integration).",
      );
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
