/**
 * Creates password_reset_tokens table for broker dashboard password reset.
 * Usage: node prisma/applyPasswordResetTokenMigration.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token")`,
  `CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId")`,
  `CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens"("token")`,

  `DO $$ BEGIN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user_accounts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function applyPasswordResetTokenMigration() {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("✅ password_reset_tokens migration applied");
}

if (require.main === module) {
  applyPasswordResetTokenMigration()
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { applyPasswordResetTokenMigration };
