/**
 * Provision (or dry-run) a GHL Agency team user for one LendingCart user.
 *
 * Usage (from backend/):
 *   node scripts/provisionGhlAgencyUser.js --organizationId=<ORG_ID> --userId=<USER_ID> --dryRun
 *   node scripts/provisionGhlAgencyUser.js --organizationId=<ORG_ID> --userId=<USER_ID>
 *
 * --dryRun performs GET /users/search only — never POST/PUT/DELETE.
 * Never prints tokens, Authorization headers, or generated passwords.
 */
require("dotenv").config();

const prisma = require("../config/prisma");
const {
  provisionOrganizationGhlAgencyUser,
  PROVISION_RESULTS,
} = require("../services/ghl/ghlAgencyUserProvisioning.service");
const { isGhlAgencyTokenConfigured } = require("../services/ghl/ghlAgency.client");

function parseArgs(argv) {
  const out = {
    organizationId: null,
    userId: null,
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--organizationId=")) {
      out.organizationId = arg.slice("--organizationId=".length).trim() || null;
    } else if (arg.startsWith("--userId=")) {
      out.userId = arg.slice("--userId=".length).trim() || null;
    } else if (arg === "--dryRun" || arg === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

function looksLikeSecretLeak(text) {
  return /GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+|"password"\s*:\s*"(?!\[GENERATED)[^"]+"/i.test(
    text,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("GHL AGENCY TEAM-USER PROVISION");
  console.log("==============================");
  console.log({
    organizationId: args.organizationId,
    userId: args.userId,
    dryRun: args.dryRun,
    tokenConfigured: isGhlAgencyTokenConfigured(),
    writeAllowed: !args.dryRun,
  });
  console.log("");

  if (!args.organizationId || !args.userId) {
    console.error(
      "Usage: node scripts/provisionGhlAgencyUser.js --organizationId=<ORG_ID> --userId=<USER_ID> [--dryRun]",
    );
    process.exitCode = 1;
    return;
  }

  if (!args.dryRun && !isGhlAgencyTokenConfigured()) {
    console.error("FAIL: GHL_AGENCY_PRIVATE_TOKEN is not configured (required for writes)");
    process.exitCode = 1;
    return;
  }

  // Use shared prisma client
  try {
    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: args.organizationId,
      userId: args.userId,
      dryRun: args.dryRun,
    });

    const safe = {
      result: result.result,
      organizationId: result.organizationId,
      userId: result.userId,
      role: result.role,
      email: result.email,
      ghlLocationId: result.ghlLocationId,
      ghlCompanyId: result.ghlCompanyId,
      ghlUserId: result.ghlUser?.userId || result.mapping?.ghlUserId || null,
      mappingStatus: result.mapping?.status || null,
      dryRun: result.dryRun,
      plannedAction: result.plannedAction || null,
      plannedPayload: result.plannedPayload || null,
      ghlApiCalled: result.ghlApiCalled,
      ghlWriteCalled: result.ghlWriteCalled,
      writes: result.writes || [],
      reason: result.reason,
    };

    const serialized = JSON.stringify(safe, null, 2);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log(serialized);
    console.log("");

    if (args.dryRun) {
      console.log("OK — dry run complete (no POST/PUT/DELETE).");
      if (result.ghlWriteCalled) {
        console.error("UNEXPECTED: dry run reported a GHL write");
        process.exitCode = 1;
      }
      return;
    }

    const ok = [
      PROVISION_RESULTS.CREATED,
      PROVISION_RESULTS.REUSED,
      PROVISION_RESULTS.UPDATED,
      PROVISION_RESULTS.ALREADY_PROVISIONED,
    ].includes(result.result);

    if (ok) {
      console.log(`OK — provision result: ${result.result}`);
    } else {
      console.error(`FAIL — provision result: ${result.result}`);
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
