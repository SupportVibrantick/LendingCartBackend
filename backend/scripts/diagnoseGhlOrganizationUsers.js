/**
 * Read-only org audit: eligible LC users vs Agency GHL team users.
 *
 * Usage (from backend/):
 *   node scripts/diagnoseGhlOrganizationUsers.js --organizationId=<ORG_ID>
 *
 * Never prints tokens. Never creates/updates GHL users.
 * Never persists OrganizationGhlAgencyUser mappings.
 */
require("dotenv").config();

const prisma = require("../config/prisma");
const {
  auditOrganizationGhlAgencyUsers,
  RECONCILE_RESULTS,
} = require("../services/ghl/ghlAgencyUsers.service");

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

function printUserBlock(entry, index) {
  console.log(`--- Eligible User ${index + 1} ---`);
  console.log(`LC userId: ${entry.userId}`);
  console.log(`LC Role: ${entry.role}`);
  console.log(`Email: ${entry.email || "(none)"}`);
  console.log(`GHL Location: ${entry.ghlLocationId || "(none)"}`);
  console.log(`Result: ${entry.result}`);
  if (entry.result === RECONCILE_RESULTS.MATCHED && entry.ghlUser) {
    console.log(`GHL User ID: ${entry.ghlUser.userId}`);
    console.log(`GHL Name: ${entry.ghlUser.name || "(none)"}`);
    console.log(`GHL Email: ${entry.ghlUser.email || "(none)"}`);
    console.log(`GHL Role: ${entry.ghlUser.role || "(none)"}`);
    console.log(`GHL Status: ${entry.ghlUser.status || "(none)"}`);
  } else if (entry.reason) {
    console.log(`Reason: ${entry.reason}`);
  }
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.organizationId) {
    console.error(
      "Usage: node scripts/diagnoseGhlOrganizationUsers.js --organizationId=<ORG_ID>",
    );
    process.exitCode = 1;
    return;
  }

  // Use shared prisma client
  let persistSpyCalled = false;
  const originalUpsert = prisma.organizationGhlAgencyUser?.upsert?.bind(
    prisma.organizationGhlAgencyUser,
  );
  if (prisma.organizationGhlAgencyUser) {
    prisma.organizationGhlAgencyUser.upsert = async (...args) => {
      persistSpyCalled = true;
      if (originalUpsert) return originalUpsert(...args);
      throw new Error("Unexpected persist during diagnostic");
    };
  }

  try {
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: args.organizationId,
    });

    const serialized = JSON.stringify(audit);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log("GHL AGENCY USER RECONCILIATION");
    console.log("==============================");
    console.log("");
    console.log(
      `Organization: ${audit.organizationName || "(unknown)"} (${audit.organizationId})`,
    );
    console.log(`GHL Location: ${audit.ghlLocationId || "(none)"}`);
    console.log("");
    console.log("Eligible LendingCart Users:");
    console.log("");

    if (!audit.eligibleUsers.length) {
      console.log("(none)");
      console.log("");
    } else {
      audit.eligibleUsers.forEach((entry, index) => printUserBlock(entry, index));
    }

    if (audit.excludedSubBrokers.length) {
      console.log("Excluded SUB_BROKER users (never provisioned):");
      for (const sb of audit.excludedSubBrokers) {
        console.log(`- ${sb.userId}  ${sb.email || "(no email)"}`);
      }
      console.log("");
    }

    console.log("Summary:");
    console.log(`MATCHED: ${audit.summary.MATCHED}`);
    console.log(`NOT_PROVISIONED: ${audit.summary.NOT_PROVISIONED}`);
    console.log(`AMBIGUOUS: ${audit.summary.AMBIGUOUS}`);
    console.log(`SUB_BROKER_EXCLUDED: ${audit.summary.SUB_BROKER_EXCLUDED}`);
    if (audit.summary.NOT_CONFIGURED) {
      console.log(`NOT_CONFIGURED: ${audit.summary.NOT_CONFIGURED}`);
    }
    if (audit.summary.ERROR) {
      console.log(`ERROR: ${audit.summary.ERROR}`);
    }
    console.log("");
    console.log(
      audit.ghlApiCalled
        ? "GHL API called: GET /users/search only (read-only)."
        : "GHL API called: no.",
    );
    console.log("No GHL writes performed.");
    console.log(
      persistSpyCalled
        ? "WARNING: mapping persistence was attempted (unexpected)."
        : "No OrganizationGhlAgencyUser mappings persisted.",
    );

    if (persistSpyCalled) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
