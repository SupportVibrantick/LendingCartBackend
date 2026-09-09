/**
 * Read-only diagnostic: subscription → Agency GHL location readiness.
 *
 * Usage (from backend/):
 *   node scripts/diagnoseOrganizationGhlSetup.js --organizationId=<ORG_ID>
 *
 * Does not modify DB or call GHL write APIs.
 */
require("dotenv").config();

const prisma = require("../config/prisma");
const {
  diagnoseOrganizationGhlSetup,
  SETUP_STATUS,
} = require("../services/ghl/diagnoseOrganizationGhlSetup.service");

function parseArgs(argv) {
  const out = { organizationId: null };
  for (const arg of argv) {
    if (arg.startsWith("--organizationId=")) {
      out.organizationId = arg.slice("--organizationId=".length).trim() || null;
    }
  }
  return out;
}

function looksLikeSecretLeak(text) {
  return /GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+|access_token|refresh_token|enc:v1:/i.test(
    text,
  );
}

function printBlock(title, lines) {
  console.log(title);
  for (const line of lines) console.log(`  ${line}`);
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.organizationId) {
    console.error(
      "Usage: node scripts/diagnoseOrganizationGhlSetup.js --organizationId=<ORG_ID>",
    );
    process.exitCode = 1;
    return;
  }

  // Use shared prisma client
  try {
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: args.organizationId,
    });

    const serialized = JSON.stringify(report);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log("GHL ORGANIZATION SETUP DIAGNOSTIC");
    console.log("=================================");
    console.log("");

    printBlock("1. Organization", [
      `organizationId: ${report.organization?.organizationId || "(none)"}`,
      `name: ${report.organization?.name || "(none)"}`,
      `type: ${report.organization?.type || "(none)"}`,
    ]);

    printBlock("2. Subscription", [
      `status: ${report.subscription?.status || "(none)"}`,
      `packageCode: ${report.subscription?.packageCode || "(none)"}`,
      `billingCycle: ${report.subscription?.billingCycle || "(none)"}`,
      `ghlSubscriptionId: ${report.subscription?.ghlSubscriptionId || "(none)"}`,
    ]);

    printBlock("3. Agency location mapping", [
      `mapping exists: ${report.agencyLocation?.mappingExists ? "YES" : "NO"}`,
      `packageCode: ${report.agencyLocation?.packageCode || "(none)"}`,
      `ghlCompanyId: ${report.agencyLocation?.ghlCompanyId || "(none)"}`,
      `ghlLocationId: ${report.agencyLocation?.ghlLocationId || "(none)"}`,
      `status: ${report.agencyLocation?.status || "(none)"}`,
      `assignedAt: ${
        report.agencyLocation?.assignedAt
          ? new Date(report.agencyLocation.assignedAt).toISOString()
          : "(none)"
      }`,
    ]);

    printBlock("4. Expected configuration", [
      `package: ${report.expected?.packageCode || "(none)"}`,
      `envKey: ${report.expected?.envKey || "(none)"}`,
      `expectedLocationId: ${report.expected?.locationId || "(none)"}`,
      `locationMatchesMapping: ${
        report.expected?.locationMatchesMapping ? "YES" : "NO"
      }`,
    ]);

    console.log("5. Final diagnostic status");
    console.log(`  ${report.status}`);
    if (report.status === SETUP_STATUS.NOT_READY) {
      console.log("  Reasons:");
      for (const reason of report.reasons || []) {
        console.log(`  - ${reason}`);
      }
    }
    console.log("");
    console.log("No DB writes. No GHL writes. No mappings created.");

    if (report.status !== SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
