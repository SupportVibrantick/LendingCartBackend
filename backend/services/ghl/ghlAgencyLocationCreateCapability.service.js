/**
 * Read-only assessment of Agency GHL sub-account (location) CREATE capability.
 *
 * Official source of truth:
 *   https://marketplace.gohighlevel.com/docs/ghl/locations/create-location/
 *
 * NEVER calls POST / PUT / DELETE.
 * Optionally probes GET /locations/search to confirm locations.readonly works.
 *
 * Does not change Prisma, fulfillment, billing, OAuth, frontend, or production routes.
 */

const {
  isGhlAgencyTokenConfigured,
  GHL_API_BASE,
  GHL_API_VERSION,
} = require("./ghlAgency.client");
const { listAgencyLocations } = require("./ghlAgencyLocations.service");
const { getAgencyCompanyId } = require("./ghlAccountLocation.service");

/**
 * Contract verified from HighLevel Marketplace "Create Sub-Account (Formerly Location)".
 * Fields below are taken from that documentation — not invented.
 */
const OFFICIAL_CREATE_LOCATION_CONTRACT = Object.freeze({
  documentationUrl:
    "https://marketplace.gohighlevel.com/docs/ghl/locations/create-location/",
  method: "POST",
  path: "/locations/",
  absoluteUrl: "https://services.leadconnectorhq.com/locations/",
  requiredScope: "locations.write",
  auth:
    "Agency OAuth access token OR Agency Private Integration token (Bearer)",
  agencyPlanRequirement:
    "Official docs state: This feature is only available on Agency Pro ($497) plan.",
  versionHeader: {
    marketplaceUiOptions: ["v3"],
    officialCurlExample: "2021-07-28",
    lendingCartAgencyClient: GHL_API_VERSION,
  },
  requiredBodyFields: Object.freeze(["name", "companyId"]),
  optionalBodyFields: Object.freeze([
    "phone",
    "address",
    "city",
    "state",
    "country",
    "postalCode",
    "website",
    "timezone",
    "prospectInfo",
    "settings",
    "social",
    "twilio (deprecated)",
    "mailgun",
    "snapshotId",
  ]),
  responseFieldsDocumented: Object.freeze([
    "id",
    "companyId",
    "name",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "domain",
    "country",
    "postalCode",
    "website",
    "timezone",
    "settings",
    "social",
  ]),
  initialTeamUserCreation:
    "NOT part of POST /locations/ response schema. Team users are created via separate POST /users/ (requires users.write). prospectInfo on create is business/prospect metadata, not a documented substitute for POST /users/.",
  proEliteSetupViaApi:
    "Optional snapshotId can load a snapshot into the new sub-account at creation. There is no create-body field named PRO or ELITE — plan templates are snapshot-driven (or configured after create).",
});

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

function envConfigured(key) {
  return Boolean(process.env[key] && String(process.env[key]).trim());
}

/**
 * @param {{
 *   probeList?: boolean,
 *   listLocationsFn?: Function,
 * }} [options]
 */
async function assessAgencyLocationCreateCapability({
  probeList = true,
  listLocationsFn = null,
} = {}) {
  let companyId = null;
  let companyIdError = null;
  try {
    companyId = getAgencyCompanyId();
  } catch (err) {
    companyIdError = redactSecrets(String(err?.message || err));
  }

  const env = {
    GHL_AGENCY_PRIVATE_TOKEN: isGhlAgencyTokenConfigured(),
    GHL_AGENCY_COMPANY_ID: Boolean(companyId),
    GHL_PRO_LOCATION_ID: envConfigured("GHL_PRO_LOCATION_ID"),
    GHL_ELITE_LOCATION_ID: envConfigured("GHL_ELITE_LOCATION_ID"),
    // Not currently part of LendingCart .env.example — listed for future dedicated-location work.
    GHL_PRO_SNAPSHOT_ID: envConfigured("GHL_PRO_SNAPSHOT_ID"),
    GHL_ELITE_SNAPSHOT_ID: envConfigured("GHL_ELITE_SNAPSHOT_ID"),
  };

  const listProbe = {
    performed: false,
    ok: false,
    code: null,
    locationCount: null,
    message: null,
    scopesInferredWorking: [],
  };

  if (probeList) {
    if (!isGhlAgencyTokenConfigured() && !listLocationsFn) {
      listProbe.code = "TOKEN_MISSING";
      listProbe.message =
        "Skipped list probe — GHL_AGENCY_PRIVATE_TOKEN is not configured";
    } else {
      listProbe.performed = true;
      const listFn = listLocationsFn || listAgencyLocations;
      try {
        const listed = await listFn({
          companyId,
          limit: 10,
          skip: 0,
        });
        if (listed?.ok === false) {
          listProbe.ok = false;
          listProbe.code = listed.code || "LIST_FAILED";
          listProbe.message = redactSecrets(listed.message || "List failed");
          listProbe.locationCount = 0;
        } else {
          listProbe.ok = true;
          listProbe.code = listed?.code || "OK";
          listProbe.locationCount = Array.isArray(listed?.locations)
            ? listed.locations.length
            : listed?.meta?.count ?? null;
          listProbe.scopesInferredWorking = ["locations.readonly"];
          listProbe.message = redactSecrets(
            listed?.message ||
              "GET /locations/search succeeded — Agency PI can list locations",
          );
        }
      } catch (err) {
        listProbe.ok = false;
        listProbe.code = "LIST_EXCEPTION";
        listProbe.message = redactSecrets(String(err?.message || err));
      }
    }
  }

  const writeCapability = {
    canProveLocationsWriteWithoutPost: false,
    requiredScopePerOfficialDocs: "locations.write",
    /**
     * Operator-reported (conversation): Loan Automation Agency PI has
     * locations.readonly, locations.write, users.readonly, users.write.
     * This diagnostic does not introspect PI UI scopes via API.
     */
    liveWriteVerified: false,
    liveWriteVerificationBlockedReason:
      "Diagnostic never POSTs. locations.write cannot be proven without a real create call.",
    agencyProPlanRequiredByDocs: true,
    agencyProPlanVerified: null,
    agencyProPlanNote:
      "Confirm Agency Pro ($497) manually in GHL billing — not detectable via read-only location search.",
  };

  const architectureGap = {
    currentModel:
      "Each Broker Organization gets ONE dedicated GHL sub-account via POST /locations/. PRO/ELITE select optional snapshot templates (GHL_PRO_SNAPSHOT_ID / GHL_ELITE_SNAPSHOT_ID), not shared location pools.",
    targetBusinessModel:
      "Each Broker Organization should have ONE dedicated GHL sub-account/location. PRO/ELITE are LC subscription plans, not shared GHL accounts.",
    createApiSupportsDedicatedLocations: true,
    productionBehaviorUnchanged: false,
    dedicatedPerOrgLocationsEnabled: true,
  };

  const blockers = [];
  if (!env.GHL_AGENCY_PRIVATE_TOKEN) blockers.push("GHL_AGENCY_PRIVATE_TOKEN missing");
  if (!env.GHL_AGENCY_COMPANY_ID) blockers.push("GHL_AGENCY_COMPANY_ID missing");
  if (probeList && !listProbe.ok) {
    blockers.push("GET /locations/search probe did not succeed (locations.readonly)");
  }
  blockers.push("locations.write not live-verified (no POST by this diagnostic)");
  blockers.push("Agency Pro plan must be confirmed manually");
  if (!env.GHL_PRO_SNAPSHOT_ID || !env.GHL_ELITE_SNAPSHOT_ID) {
    blockers.push(
      "Optional: GHL_PRO_SNAPSHOT_ID / GHL_ELITE_SNAPSHOT_ID not configured (needed only if using snapshotId for plan templates)",
    );
  }

  return {
    mode: "READ_ONLY",
    writePerformed: false,
    httpMethodsAllowedInThisDiagnostic: ["GET"],
    apiBase: GHL_API_BASE,
    apiVersionHeader: GHL_API_VERSION,
    companyId: companyId || null,
    companyIdError,
    env,
    officialContract: OFFICIAL_CREATE_LOCATION_CONTRACT,
    listProbe,
    writeCapability,
    architectureGap,
    readinessForFutureImplementation: {
      officialEndpointDocumented: true,
      requiredBodyKnown: true,
      agencyTokenConfigured: env.GHL_AGENCY_PRIVATE_TOKEN,
      companyIdConfigured: env.GHL_AGENCY_COMPANY_ID,
      locationsReadonlyProbeOk: listProbe.ok,
      dedicatedPerOrgLocationsEnabled: true,
      safeToChangeProductionMappingYet: false,
      blockers,
    },
    exampleCreateBodyShape: {
      name: "<Broker Organization Name>",
      companyId: companyId || "<GHL_AGENCY_COMPANY_ID>",
      phone: "<optional E.164>",
      address: "<optional>",
      city: "<optional>",
      state: "<optional>",
      country: "<optional ISO-2>",
      postalCode: "<optional>",
      website: "<optional>",
      timezone: "<optional>",
      snapshotId: "<optional snapshot for PRO or ELITE template>",
      prospectInfo: {
        firstName: "<optional>",
        lastName: "<optional>",
        email: "<optional — not a replacement for POST /users/>",
      },
    },
  };
}

module.exports = {
  OFFICIAL_CREATE_LOCATION_CONTRACT,
  assessAgencyLocationCreateCapability,
};
