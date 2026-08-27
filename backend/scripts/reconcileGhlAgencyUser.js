/**
 * Read-only CLI: reconcile one LendingCart user against Agency GHL team users.
 *
 * Usage (from backend/):
 *   node scripts/reconcileGhlAgencyUser.js --organizationId=<ORG_ID> --userId=<USER_ID>
 *
 * Never prints tokens. Never creates/updates GHL users.
 */
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const {
  reconcileOrganizationGhlAgencyUser,
  RECONCILE_RESULTS,
} = require("../services/ghl/ghlAgencyUsers.service");

function parseArgs(argv) {
  const out = { organizationId: null, userId: null };
  for (const arg of argv) {
    if (arg.startsWith("--organizationId=")) {
      out.organizationId = arg.slice("--organizationId=".length).trim() || null;
    } else if (arg.startsWith("--userId=")) {
      out.userId = arg.slice("--userId=".length).trim() || null;
    }
  }
  return out;
}

function looksLikeSecretLeak(text) {
  return /GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+/i.test(
    text,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.organizationId || !args.userId) {
    console.error(
      "Usage: node scripts/reconcileGhlAgencyUser.js --organizationId=<ORG_ID> --userId=<USER_ID>",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: args.organizationId,
      userId: args.userId,
    });

    const serialized = JSON.stringify(result);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log("GHL AGENCY USER RECONCILIATION");
    console.log("==============================");
    console.log("");
    console.log(`Organization: ${result.organizationId}`);
    console.log(`LC User: ${result.userId}`);
    console.log(`LC Role: ${result.role || "(none)"}`);
    console.log(`Email: ${result.email || "(none)"}`);
    console.log("");
    console.log(`GHL Location: ${result.ghlLocationId || "(none)"}`);
    console.log("");
    console.log(`Result: ${result.result}`);

    if (result.result === RECONCILE_RESULTS.MATCHED && result.ghlUser) {
      console.log("");
      console.log(`GHL User ID: ${result.ghlUser.userId}`);
      console.log(`GHL Name: ${result.ghlUser.name || "(none)"}`);
      console.log(`GHL Email: ${result.ghlUser.email || "(none)"}`);
      console.log(`GHL Status: ${result.ghlUser.status || "(none)"}`);
    } else if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }

    if (result.result === RECONCILE_RESULTS.AMBIGUOUS) {
      console.log(`Match count: ${result.matches?.length || 0}`);
    }

    console.log("");
    console.log(
      result.ghlApiCalled
        ? "GHL API called: GET /users/search only (read-only)."
        : "GHL API called: no (skipped).",
    );
    console.log("No GHL writes performed.");

    if (
      result.result !== RECONCILE_RESULTS.MATCHED &&
      result.result !== RECONCILE_RESULTS.NOT_PROVISIONED
    ) {
      process.exitCode =
        result.result === RECONCILE_RESULTS.NOT_ELIGIBLE ||
        result.result === RECONCILE_RESULTS.NOT_CONFIGURED
          ? 0
          : 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
