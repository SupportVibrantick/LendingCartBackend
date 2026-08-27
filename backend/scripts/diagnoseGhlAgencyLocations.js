/**
 * Temporary diagnostic: print safe Agency location fields for Pro/Elite mapping.
 *
 * Usage (from backend/):
 *   node scripts/diagnoseGhlAgencyLocations.js
 *
 * Read-only. Does not modify DB or GHL.
 * Never prints GHL_AGENCY_PRIVATE_TOKEN.
 *
 * Identification of Pro / Elite / other is by the GHL-returned `name` field only —
 * this script does not guess from locationId.
 */
require("dotenv").config();

const {
  listAgencyLocations,
} = require("../services/ghl/ghlAgencyLocations.service");

const SAFE_FIELDS = [
  "locationId",
  "name",
  "companyId",
  "address",
  "city",
  "state",
  "country",
  "postalCode",
];

function displayValue(value) {
  if (value == null || value === "") return "(none)";
  return String(value);
}

function printLocationBlock(loc, index) {
  console.log(`--- Location ${index + 1} ---`);
  for (const field of SAFE_FIELDS) {
    console.log(`${field}: ${displayValue(loc[field])}`);
  }
  console.log("");
}

function nameHint(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "other (name empty — identify manually in GHL UI)";
  if (n === "pro account" || n.includes("pro account")) {
    return "matches name \"Pro Account\" (from GHL name field only)";
  }
  if (n === "elite account" || n.includes("elite account")) {
    return "matches name \"Elite Account\" (from GHL name field only)";
  }
  return "other agency location (name does not match Pro/Elite Account)";
}

async function main() {
  const result = await listAgencyLocations({ limit: 100, skip: 0 });

  if (!result.ok) {
    console.error("Failed to list Agency locations.");
    console.error({
      code: result.code,
      message: result.message,
      status: result.meta?.status || null,
    });
    process.exitCode = 1;
    return;
  }

  const locations = Array.isArray(result.locations) ? result.locations : [];

  // Leak guard
  const serialized = JSON.stringify(locations);
  if (/GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]+/i.test(serialized)) {
    console.error("Refusing to print: possible secret leakage detected");
    process.exitCode = 2;
    return;
  }

  console.log("GHL AGENCY LOCATIONS");
  console.log("====================");
  console.log(`count: ${locations.length}`);
  console.log("note: Pro/Elite labels below are based only on the GHL name field.");
  console.log("      locationId is never used to guess Pro vs Elite.");
  console.log("");

  locations.forEach((loc, index) => {
    printLocationBlock(loc, index);
    console.log(`name-based label: ${nameHint(loc.name)}`);
    console.log("");
  });
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
