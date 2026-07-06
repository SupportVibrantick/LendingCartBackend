/**
 * Idempotent email_outbox table patch for brownfield databases.
 */
const { PrismaClient } = require("@prisma/client");

const SQL_STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE "EmailOutboxProvider" AS ENUM ('SMTP', 'GHL');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "email_outbox" (
    "id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "templateKey" TEXT,
    "templateData" JSONB,
    "provider" "EmailOutboxProvider" NOT NULL DEFAULT 'SMTP',
    "providerMeta" JSONB,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMPTZ(6),
    "idempotencyKey" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_idempotencyKey_key"
    ON "email_outbox"("idempotencyKey")`,
  `CREATE INDEX IF NOT EXISTS "email_outbox_status_nextAttemptAt_idx"
    ON "email_outbox"("status", "nextAttemptAt")`,
  `CREATE INDEX IF NOT EXISTS "email_outbox_createdAt_idx"
    ON "email_outbox"("createdAt")`,
];

async function ensureEmailOutbox(existingPrisma) {
  const shouldDisconnect = !existingPrisma;
  const prisma = existingPrisma || new PrismaClient();

  try {
    for (const sql of SQL_STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log("✅ Email outbox table patched");
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  ensureEmailOutbox()
    .catch((error) => {
      console.error("❌ Email outbox patch failed:", error);
      process.exit(1);
    });
}

module.exports = { ensureEmailOutbox };
