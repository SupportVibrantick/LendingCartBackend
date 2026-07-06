/**
 * Idempotent job_locks + document reminder job fields + invoice idempotency patch.
 */
const { PrismaClient } = require("@prisma/client");

const SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "job_locks" (
    "name" TEXT NOT NULL,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("name")
  )`,
  `ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lockedBy" TEXT`,
  `ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ(6)`,
  `ALTER TABLE "document_reminder_schedules"
    ADD COLUMN IF NOT EXISTS "lastError" TEXT`,
  `ALTER TABLE "subscription_invoices"
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_invoices_idempotencyKey_key"
    ON "subscription_invoices"("idempotencyKey")`,
];

async function ensureSchedulerJobLocks(existingPrisma) {
  const shouldDisconnect = !existingPrisma;
  const prisma = existingPrisma || new PrismaClient();

  try {
    for (const sql of SQL_STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log("✅ Scheduler job lock tables/columns patched");
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  ensureSchedulerJobLocks()
    .catch((error) => {
      console.error("❌ Scheduler job lock patch failed:", error);
      process.exit(1);
    });
}

module.exports = { ensureSchedulerJobLocks };
