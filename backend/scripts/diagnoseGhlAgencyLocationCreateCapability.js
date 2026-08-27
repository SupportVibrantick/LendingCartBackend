/**
 * Read-only diagnostic: can this Agency PI support future per-org location creation?
 *
 * Usage (from backend/):
 *   node scripts/diagnoseGhlAgencyLocationCreateCapability.js
 *
 * - Documents official POST /locations/ contract
 * - Probes GET /locations/search only
 * - Never POST/PUT/DELETE
 * - Never prints tokens
 */
require("dotenv").config();

const {
  assessAgencyLocationCreateCapability,
} = require("../services/ghl/ghlAgencyLocationCreateCapability.service");

function looksLikeSecretLeak(text) {
  return /GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+|Bearer\s+[A-Za-z0-9._-]{10,}|\bpit-[A-Za-z0-9]+/i.test(
    text,
  );
}

async function main() {
  const report = await assessAgencyLocationCreateCapability({ probeList: true });
  const serialized = JSON.stringify(report, null, 2);

  if (looksLikeSecretLeak(serialized)) {
    console.error("Refusing to print: possible secret leakage detected");
    process.exitCode = 2;
    return;
  }

  console.log("GHL AGENCY LOCATION CREATE CAPABILITY (READ-ONLY)");
  console.log("=================================================");
  console.log(serialized);
  console.log("");
  console.log("SUMMARY");
  console.log("-------");
  console.log(`Write performed: ${report.writePerformed}`);
  console.log(
    `Official create endpoint: ${report.officialContract.method} ${report.officialContract.path}`,
  );
  console.log(
    `Required scope: ${report.officialContract.requiredScope}`,
  );
  console.log(
    `locations.readonly probe: ${report.listProbe.ok ? "OK" : "FAILED/SKIPPED"} (${report.listProbe.code || "n/a"})`,
  );
  console.log(
    `locations.write live-verified: ${report.writeCapability.liveWriteVerified}`,
  );
  console.log(
    `Safe to change production mapping yet: ${report.readinessForFutureImplementation.safeToChangeProductionMappingYet}`,
  );
  console.log("Blockers:");
  for (const b of report.readinessForFutureImplementation.blockers) {
    console.log(`  - ${b}`);
  }

  if (!report.listProbe.ok && report.listProbe.performed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
