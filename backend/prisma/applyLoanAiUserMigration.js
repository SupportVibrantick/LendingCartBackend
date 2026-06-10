/**
 * Creates loan_ai_users table for Loan AI marketing-site auth.
 * Usage: node prisma/applyLoanAiUserMigration.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "loan_ai_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "brokerOrganizationId" UUID,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_ai_users_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "loan_ai_users_email_key" ON "loan_ai_users"("email")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "loan_ai_users_brokerOrganizationId_key" ON "loan_ai_users"("brokerOrganizationId")`,

  `DO $$ BEGIN
    ALTER TABLE "loan_ai_users"
      ADD CONSTRAINT "loan_ai_users_brokerOrganizationId_fkey"
      FOREIGN KEY ("brokerOrganizationId") REFERENCES "organizations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function applyLoanAiUserMigration() {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("✅ loan_ai_users migration applied");
}

if (require.main === module) {
  applyLoanAiUserMigration()
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { applyLoanAiUserMigration };
