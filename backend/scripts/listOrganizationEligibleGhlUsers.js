/**
 * Read-only: list LendingCart users eligible for Agency GHL team-user provisioning.
 *
 * Usage (from backend/):
 *   node scripts/listOrganizationEligibleGhlUsers.js --organizationId=<ORG_ID>
 *
 * Prints userAccount.id (UUID), firstName, lastName, email, role.
 * Does NOT call GHL. Does NOT modify the database.
 * Never prints passwords, tokens, or auth secrets.
 */
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const {
  listOrganizationEligibleGhlUsers,
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
  return /passwordHash|password|GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+|access_token|refresh_token|enc:v1:/i.test(
    text,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.organizationId) {
    console.error(
      "Usage: node scripts/listOrganizationEligibleGhlUsers.js --organizationId=<ORG_ID>",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await listOrganizationEligibleGhlUsers(prisma, {
      organizationId: args.organizationId,
    });

    const safe = {
      organizationId: result.organizationId,
      organizationName: result.organizationName,
      eligibleCount: result.users.length,
      excludedSubBrokerCount: result.excludedSubBrokerCount,
      reason: result.reason,
      users: result.users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      })),
    };

    const serialized = JSON.stringify(safe, null, 2);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log("ELIGIBLE GHL USERS (DB ONLY — NO GHL API)");
    console.log("=========================================");
    console.log(serialized);
    console.log("");

    if (!result.organizationName && result.reason) {
      console.error(`NOTE: ${result.reason}`);
      process.exitCode = 1;
      return;
    }

    if (result.users.length === 0) {
      console.log("No BROKER_ADMIN / BROKER_OFFICER users found for this organization.");
      return;
    }

    console.log("Copy a user id into provision:");
    console.log(
      `  node scripts/provisionGhlAgencyUser.js --organizationId=${result.organizationId} --userId=<id> --dryRun`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
