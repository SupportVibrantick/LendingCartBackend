/**
 * Apply GHL sync columns if missing, then mark failed migration as applied.
 * Usage: node scripts/fixBookDemoGhlMigration.js
 */
require("dotenv").config();
const prisma = require("../config/prisma");
const { execSync } = require("child_process");

async function main() {
  // Use shared prisma client

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "GhlSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "loan_ai_book_demo_leads"
      ADD COLUMN IF NOT EXISTS "interestedPlanCode" TEXT,
      ADD COLUMN IF NOT EXISTS "interestedPlanName" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlSyncStatus" "GhlSyncStatus" NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlSyncedAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "ghlLastError" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_book_demo_leads_ghlSyncStatus_idx"
      ON "loan_ai_book_demo_leads"("ghlSyncStatus");
  `);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'loan_ai_book_demo_leads'
    ORDER BY ordinal_position
  `);
  console.log(
    "columns after fix:",
    cols.map((c) => c.column_name),
  );

  await prisma.$disconnect();

  execSync(
    'npx prisma migrate resolve --applied "20260810100000_loan_ai_book_demo_ghl_sync"',
    { stdio: "inherit" },
  );

  console.log("Migration marked as applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
