require("dotenv").config();
const prisma = require("../config/prisma");
const { execSync } = require("child_process");

async function main() {
  // Use shared prisma client

  // Postgres: ADD VALUE cannot run inside a transaction block in older versions;
  // Prisma $executeRaw often wraps in a transaction — use DO with exception handling.
  for (const value of ["PENDING", "FAILED"]) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "OrganizationSubscriptionStatus" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    } catch (err) {
      // IF NOT EXISTS unsupported on older PG — ignore duplicate
      if (!String(err.message || "").includes("already exists")) {
        console.warn(`Enum add ${value}:`, err.message);
      }
    }
  }

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "GhlPaymentStatus" AS ENUM (
        'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "organization_subscriptions"
      ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlPriceId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlProductId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlInvoiceId" TEXT,
      ADD COLUMN IF NOT EXISTS "loanAiUserId" UUID;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "organization_subscriptions"
        ADD CONSTRAINT "organization_subscriptions_loanAiUserId_fkey"
        FOREIGN KEY ("loanAiUserId") REFERENCES "loan_ai_users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  for (const idx of [
    `CREATE INDEX IF NOT EXISTS "organization_subscriptions_loanAiUserId_idx" ON "organization_subscriptions"("loanAiUserId")`,
    `CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlContactId_idx" ON "organization_subscriptions"("ghlContactId")`,
    `CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlSubscriptionId_idx" ON "organization_subscriptions"("ghlSubscriptionId")`,
    `CREATE INDEX IF NOT EXISTS "organization_subscriptions_ghlPriceId_idx" ON "organization_subscriptions"("ghlPriceId")`,
  ]) {
    await prisma.$executeRawUnsafe(idx);
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "subscription_invoices"
      ADD COLUMN IF NOT EXISTS "ghlInvoiceId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
      ADD COLUMN IF NOT EXISTS "ghlTransactionId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "subscription_invoices_ghlInvoiceId_idx"
      ON "subscription_invoices"("ghlInvoiceId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "subscription_invoices_ghlSubscriptionId_idx"
      ON "subscription_invoices"("ghlSubscriptionId");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "loan_ai_ghl_checkouts"
      ADD COLUMN IF NOT EXISTS "paymentStatus" "GhlPaymentStatus" NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "ghlSubscriptionId" TEXT,
      ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "organizationSubscriptionId" UUID;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loan_ai_ghl_checkouts"
        ADD CONSTRAINT "loan_ai_ghl_checkouts_organizationSubscriptionId_fkey"
        FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_organizationSubscriptionId_key"
      ON "loan_ai_ghl_checkouts"("organizationSubscriptionId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_paymentStatus_idx"
      ON "loan_ai_ghl_checkouts"("paymentStatus");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlSubscriptionId_idx"
      ON "loan_ai_ghl_checkouts"("ghlSubscriptionId");
  `);

  console.log("GHL subscription/payment columns applied.");
  await prisma.$disconnect();

  try {
    execSync(
      'npx prisma migrate resolve --applied "20260811150000_ghl_subscription_payment_fields"',
      { stdio: "inherit" },
    );
  } catch {
    // already applied
  }

  try {
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch {
    console.warn(
      "prisma generate failed (EPERM if API is running). Restart API after generate.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
