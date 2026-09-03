require("dotenv").config();
const prisma = require("../config/prisma");
const { execSync } = require("child_process");

async function main() {
  // Use shared prisma client

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ghl_webhook_events" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "webhookId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'RECEIVED',
      "ghlContactId" TEXT,
      "ghlInvoiceId" TEXT,
      "ghlSubscriptionId" TEXT,
      "checkoutId" UUID,
      "loanAiUserId" UUID,
      "errorMessage" TEXT,
      "payloadSummary" JSONB,
      "processedAt" TIMESTAMPTZ(6),
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ghl_webhook_events_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ghl_webhook_events_webhookId_key"
      ON "ghl_webhook_events"("webhookId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ghl_webhook_events_eventType_idx"
      ON "ghl_webhook_events"("eventType");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ghl_webhook_events_status_idx"
      ON "ghl_webhook_events"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ghl_webhook_events_ghlContactId_idx"
      ON "ghl_webhook_events"("ghlContactId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ghl_webhook_events_ghlInvoiceId_idx"
      ON "ghl_webhook_events"("ghlInvoiceId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ghl_webhook_events_checkoutId_idx"
      ON "ghl_webhook_events"("checkoutId");
  `);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ghl_webhook_events' ORDER BY ordinal_position
  `);
  console.log(
    "ghl_webhook_events columns:",
    rows.map((r) => r.column_name),
  );

  await prisma.$disconnect();

  try {
    execSync(
      'npx prisma migrate resolve --applied "20260811160000_ghl_webhook_events"',
      { stdio: "inherit" },
    );
  } catch {
    // already applied
  }

  try {
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch {
    console.warn("prisma generate failed (EPERM if API running). Restart API.");
  }

  console.log("GHL webhook events table ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
