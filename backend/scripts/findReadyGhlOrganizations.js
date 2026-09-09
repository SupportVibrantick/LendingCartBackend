/**
 * Read-only: find organizations READY for Agency GHL team-user provisioning,
 * then list eligible LC users (BROKER_ADMIN / BROKER_OFFICER) for the first match.
 *
 * Usage (from backend/):
 *   node scripts/findReadyGhlOrganizations.js
 *   node scripts/findReadyGhlOrganizations.js --limit=50
 *
 * Does NOT modify DB. Does NOT call GHL write APIs.
 */
require("dotenv").config();

const prisma = require("../config/prisma");
const {
  findOrganizationsReadyForGhlUserProvisioning,
} = require("../services/ghl/diagnoseOrganizationGhlSetup.service");
const {
  listOrganizationEligibleGhlUsers,
} = require("../services/ghl/ghlAgencyUsers.service");

function parseArgs(argv) {
  const out = { limit: 50 };
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) out.limit = n;
    }
  }
  return out;
}

function looksLikeSecretLeak(text) {
  return /passwordHash|GHL_AGENCY_PRIVATE_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}|pit-[A-Za-z0-9]+|access_token|refresh_token|enc:v1:/i.test(
    text,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Use shared prisma client

  try {
    const found = await findOrganizationsReadyForGhlUserProvisioning(prisma, {
      limit: args.limit,
    });

    console.log("READY GHL ORGANIZATIONS (DB ONLY)");
    console.log("=================================");
    console.log(
      JSON.stringify(
        {
          candidatesScanned: found.candidatesScanned,
          readyCount: found.readyCount,
          organizations: found.organizations,
        },
        null,
        2,
      ),
    );
    console.log("");

    if (found.readyCount === 0) {
      console.log(
        "NO READY ORGANIZATION FOUND — no DB/GHL changes made. Create/sync an ACTIVE PRO/ELITE Agency location mapping first.",
      );
      process.exitCode = 1;
      return;
    }

    const org = found.organizations[0];
    const eligible = await listOrganizationEligibleGhlUsers(prisma, {
      organizationId: org.organizationId,
    });

    const payload = {
      selectedOrganization: org,
      eligibleUsers: eligible.users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      })),
      excludedSubBrokerCount: eligible.excludedSubBrokerCount,
    };

    const serialized = JSON.stringify(payload, null, 2);
    if (looksLikeSecretLeak(serialized)) {
      console.error("Refusing to print: possible secret leakage detected");
      process.exitCode = 2;
      return;
    }

    console.log("FIRST READY ORG + ELIGIBLE USERS");
    console.log("================================");
    console.log(serialized);
    console.log("");
    if (eligible.users[0]) {
      console.log("Example dry-run provision:");
      console.log(
        `  node scripts/provisionGhlAgencyUser.js --organizationId=${org.organizationId} --userId=${eligible.users[0].id} --dryRun`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || String(err));
  process.exitCode = 1;
});
