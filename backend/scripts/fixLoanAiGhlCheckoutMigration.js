require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

async function main() {
  const prisma = new PrismaClient();

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LoanAiGhlCheckoutStatus" AS ENUM (
        'PENDING',
        'CHECKOUT_CREATED',
        'PAID',
        'FAILED',
        'EXPIRED',
        'CANCELLED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "loan_ai_ghl_checkouts" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "loanAiUserId" UUID NOT NULL,
      "packageId" UUID NOT NULL,
      "billingCycle" "SubscriptionBillingCycle" NOT NULL,
      "status" "LoanAiGhlCheckoutStatus" NOT NULL DEFAULT 'PENDING',
      "amount" DECIMAL(10,2) NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "ghlContactId" TEXT,
      "ghlProductId" TEXT,
      "ghlPriceId" TEXT NOT NULL,
      "ghlInvoiceId" TEXT,
      "checkoutUrl" TEXT,
      "successUrl" TEXT,
      "cancelUrl" TEXT,
      "lastError" TEXT,
      "metadata" JSONB,
      "expiresAt" TIMESTAMPTZ(6),
      "completedAt" TIMESTAMPTZ(6),
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "loan_ai_ghl_checkouts_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loan_ai_ghl_checkouts"
        ADD CONSTRAINT "loan_ai_ghl_checkouts_loanAiUserId_fkey"
        FOREIGN KEY ("loanAiUserId") REFERENCES "loan_ai_users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "loan_ai_ghl_checkouts"
        ADD CONSTRAINT "loan_ai_ghl_checkouts_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_loanAiUserId_idx"
      ON "loan_ai_ghl_checkouts"("loanAiUserId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_packageId_idx"
      ON "loan_ai_ghl_checkouts"("packageId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_status_idx"
      ON "loan_ai_ghl_checkouts"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlInvoiceId_idx"
      ON "loan_ai_ghl_checkouts"("ghlInvoiceId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "loan_ai_ghl_checkouts_ghlContactId_idx"
      ON "loan_ai_ghl_checkouts"("ghlContactId");
  `);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'loan_ai_ghl_checkouts'
    ORDER BY ordinal_position
  `);
  console.log(
    "loan_ai_ghl_checkouts columns:",
    cols.map((c) => c.column_name),
  );

  await prisma.$disconnect();

  try {
    execSync(
      'npx prisma migrate resolve --applied "20260811140000_loan_ai_ghl_checkout"',
      { stdio: "inherit" },
    );
  } catch {
    // already applied is fine
  }

  try {
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch {
    console.warn(
      "prisma generate failed (often EPERM while server holds the engine). Restart API after generate.",
    );
  }

  console.log("Loan AI GHL checkout migration ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
