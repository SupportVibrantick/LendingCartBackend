/**
 * Smoke test: list GHL Agency sub-accounts via Agency Private Integration.
 *
 * Usage (from backend/):
 *   node scripts/testGhlAgencyLocations.js
 *
 * Optional:
 *   node scripts/testGhlAgencyLocations.js --companyId=<agencyCompanyId>
 *
 * Human-readable Pro/Elite diagnostic (safe fields only):
 *   node scripts/diagnoseGhlAgencyLocations.js
 *
 * Never prints GHL_AGENCY_PRIVATE_TOKEN or Authorization headers.
 * Read-only — does not create or update locations.
 */
require("dotenv").config();

const {
  listAgencyLocations,
} = require("../services/ghl/ghlAgencyLocations.service");
const {
  isGhlAgencyTokenConfigured,
  GHL_API_BASE,
  GHL_API_VERSION,
} = require("../services/ghl/ghlAgency.client");

function parseArgs(argv) {
  const out = { companyId: null, limit: 100 };
  for (const arg of argv) {
    if (arg.startsWith("--companyId=")) {
      out.companyId = arg.slice("--companyId=".length).trim() || null;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) out.limit = n;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("GHL Agency locations smoke test (read-only)");
  console.log({
    tokenConfigured: isGhlAgencyTokenConfigured(),
    apiBase: GHL_API_BASE,
    apiVersion: GHL_API_VERSION,
    companyIdProvided: Boolean(args.companyId),
    limit: args.limit,
  });

  const result = await listAgencyLocations({
    companyId: args.companyId,
    limit: args.limit,
    skip: 0,
  });

  // Ensure token never appears in serialized output.
  const serialized = JSON.stringify(result, null, 2);
  if (/GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]+/i.test(serialized)) {
    console.error("Refusing to print result: possible secret leakage detected");
    process.exitCode = 2;
    return;
  }

  console.log(serialized);

  if (!result.ok) {
    if (result.code === "COMPANY_ID_REQUIRED") {
      console.error(
        "\nSTOP: Agency/company ID is required by the API and was not provided.",
      );
      console.error(
        "Pass --companyId=<id> once you have it from GHL Agency Settings or a prior OAuth connection.",
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nOK — ${result.locations.length} location(s) listed.`);
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
