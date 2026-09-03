require("dotenv").config();
const prisma = require("../config/prisma");
const { execSync } = require("child_process");

async function main() {
  // Remove local instantiation

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "GhlSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "admin_manual_leads"
      ADD COLUMN IF NOT EXISTS "ghlSyncStatus" "GhlSyncStatus" NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlSyncedAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "ghlLastError" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "admin_manual_leads_ghlSyncStatus_idx"
      ON "admin_manual_leads"("ghlSyncStatus");
  `);

  // Existing admin contacts were never synced — mark SKIPPED until retried
  await prisma.$executeRawUnsafe(`
    UPDATE "admin_manual_leads"
    SET "ghlSyncStatus" = 'SKIPPED',
        "ghlLastError" = COALESCE("ghlLastError", 'Pre-existing contact (not synced)')
    WHERE "ghlContactId" IS NULL
      AND ("ghlSyncStatus" = 'PENDING' OR "ghlSyncStatus" IS NULL);
  `);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'admin_manual_leads'
    ORDER BY ordinal_position
  `);
  console.log(
    "admin_manual_leads columns:",
    cols.map((c) => c.column_name),
  );

  await prisma.$disconnect();

  try {
    execSync(
      'npx prisma migrate resolve --applied "20260811120000_admin_manual_lead_ghl_sync"',
      { stdio: "inherit" },
    );
  } catch {
    // already applied is fine
  }

  console.log("Admin manual GHL columns ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
