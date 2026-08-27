/**
 * Verify PRO/ELITE location env mapping (config only — no GHL API calls).
 *
 * Usage (from backend/):
 *   node scripts/verifyGhlAccountLocations.js
 *
 * Never prints GHL_AGENCY_PRIVATE_TOKEN.
 */
require("dotenv").config();

const {
  getProLocationId,
  getEliteLocationId,
  getLocationIdForPlan,
  getAgencyCompanyId,
} = require("../services/ghl/ghlAccountLocation.service");

const EXPECTED = {
  PRO: "RQ3JZOrCXQUaIXK4FmYc",
  ELITE: "gw2PojfvG909sYV8Hrk7",
  COMPANY: "HtXpcMHxPGpsuhqe0uiM",
};

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function main() {
  // Leak guard — never print agency PIT even if somehow present in strings.
  const token = process.env.GHL_AGENCY_PRIVATE_TOKEN;
  if (token && String(token).trim()) {
    // Intentionally do not log token; only confirm presence for operators.
    console.log("GHL_AGENCY_PRIVATE_TOKEN: configured (value hidden)");
  } else {
    console.log("GHL_AGENCY_PRIVATE_TOKEN: not set (not required for this check)");
  }

  const pro = getProLocationId();
  const elite = getEliteLocationId();
  const companyId = getAgencyCompanyId();
  const proResolved = getLocationIdForPlan("PRO");
  const eliteResolved = getLocationIdForPlan("ELITE");

  assertEqual("getProLocationId()", pro, EXPECTED.PRO);
  assertEqual("getEliteLocationId()", elite, EXPECTED.ELITE);
  assertEqual("getAgencyCompanyId()", companyId, EXPECTED.COMPANY);
  assertEqual("getLocationIdForPlan(PRO).locationId", proResolved.locationId, EXPECTED.PRO);
  assertEqual(
    "getLocationIdForPlan(ELITE).locationId",
    eliteResolved.locationId,
    EXPECTED.ELITE,
  );

  console.log("GHL ACCOUNT LOCATION VERIFICATION");
  console.log("=================================");
  console.log(`PRO pool (legacy, not used for new orgs) -> ${proResolved.locationId}`);
  console.log(`ELITE pool (legacy, not used for new orgs) -> ${eliteResolved.locationId}`);
  console.log(`COMPANY -> ${companyId}  (via GHL_AGENCY_COMPANY_ID)`);
  console.log(`PRO snapshot -> ${process.env.GHL_PRO_SNAPSHOT_ID ? "configured" : "not set"}`);
  console.log(`ELITE snapshot -> ${process.env.GHL_ELITE_SNAPSHOT_ID ? "configured" : "not set"}`);
  console.log("");
  console.log("OK — company ID present. New orgs get dedicated locations via POST /locations/.");
}

try {
  main();
} catch (err) {
  console.error("FAIL:", err.message || String(err));
  process.exitCode = 1;
}
