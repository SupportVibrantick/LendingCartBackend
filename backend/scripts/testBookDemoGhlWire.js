/**
 * End-to-end wire test: DB lead → syncBookDemoLeadToGhl → upsertGhlContact.
 * Usage: node scripts/testBookDemoGhlWire.js
 */
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const {
  syncBookDemoLeadToGhl,
} = require("../services/ghl/bookDemoLeadSync");

async function main() {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const email = `lc.bookdemo.${stamp}@example.com`;
  const phone = `+1555${String(stamp).slice(-7)}`;

  console.log("GHL_ENABLED:", process.env.GHL_ENABLED);
  console.log("Creating LoanAiBookDemoLead...", { email, phone });

  const lead = await prisma.loanAiBookDemoLead.create({
    data: {
      firstName: "Book",
      lastName: "DemoWire",
      email,
      phone,
      company: "LendingCart Wire Test",
      message: "Wire test from scripts/testBookDemoGhlWire.js",
      interestedPlanCode: "STARTER",
      interestedPlanName: "Starter",
      source: "loan-ai-book-demo",
      ghlSyncStatus: "PENDING",
    },
  });

  console.log("Lead created:", lead.id);

  const updated = await syncBookDemoLeadToGhl(prisma, lead, {
    logger: console,
  });

  console.log("Sync result:", {
    id: updated.id,
    ghlSyncStatus: updated.ghlSyncStatus,
    ghlContactId: updated.ghlContactId,
    ghlSyncedAt: updated.ghlSyncedAt,
    ghlLastError: updated.ghlLastError,
  });

  if (updated.ghlSyncStatus !== "SYNCED" || !updated.ghlContactId) {
    throw new Error(
      `Expected SYNCED with contact id, got ${updated.ghlSyncStatus}: ${updated.ghlLastError}`,
    );
  }

  console.log("OK — check GHL Contacts for:", email);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
