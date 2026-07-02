-- Commission 3-module split: calculation, invoice, payout

-- Extend recipient roles
ALTER TYPE "CommissionRecipientRole" ADD VALUE IF NOT EXISTS 'BROKER';

-- New enums
CREATE TYPE "CommissionLineStatus" AS ENUM ('CALCULATED', 'VOID', 'SUPERSEDED');
CREATE TYPE "CommissionInvoiceStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'VOID');
CREATE TYPE "CommissionPayoutStatus" AS ENUM ('COMPLETED', 'REVERSED');
CREATE TYPE "CommissionAuditEventType" AS ENUM (
  'COMMISSION_CALCULATED',
  'INVOICE_GENERATED',
  'INVOICE_SENT',
  'INVOICE_VIEWED',
  'INVOICE_DOWNLOADED',
  'PAYOUT_RECORDED',
  'PAYOUT_REVERSED'
);
CREATE TYPE "CommissionAuditActorType" AS ENUM ('SYSTEM', 'USER');

-- Extend payment methods
ALTER TYPE "CommissionPaymentMethod" ADD VALUE IF NOT EXISTS 'ACH';
ALTER TYPE "CommissionPaymentMethod" ADD VALUE IF NOT EXISTS 'WIRE';
ALTER TYPE "CommissionPaymentMethod" ADD VALUE IF NOT EXISTS 'CHECK';
ALTER TYPE "CommissionPaymentMethod" ADD VALUE IF NOT EXISTS 'CASH';

-- Commission invoices
CREATE TABLE "commission_invoices" (
    "id" UUID NOT NULL,
    "deal_commission_id" UUID NOT NULL,
    "broker_org_id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "CommissionInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "pdf_url" TEXT,
    "payment_instructions" TEXT,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_user_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "viewed_at" TIMESTAMPTZ(6),
    "downloaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commission_invoices_invoice_number_key" ON "commission_invoices"("invoice_number");
CREATE INDEX "commission_invoices_deal_commission_id_idx" ON "commission_invoices"("deal_commission_id");
CREATE INDEX "commission_invoices_broker_org_id_idx" ON "commission_invoices"("broker_org_id");
CREATE INDEX "commission_invoices_loan_application_id_idx" ON "commission_invoices"("loan_application_id");
CREATE INDEX "commission_invoices_status_idx" ON "commission_invoices"("status");

-- Commission payouts
CREATE TABLE "commission_payouts" (
    "id" UUID NOT NULL,
    "deal_commission_id" UUID NOT NULL,
    "commission_invoice_id" UUID,
    "broker_org_id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "payment_method" "CommissionPaymentMethod" NOT NULL,
    "payment_reference" TEXT,
    "notes" TEXT,
    "status" "CommissionPayoutStatus" NOT NULL DEFAULT 'COMPLETED',
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_payouts_deal_commission_id_idx" ON "commission_payouts"("deal_commission_id");
CREATE INDEX "commission_payouts_broker_org_id_idx" ON "commission_payouts"("broker_org_id");
CREATE INDEX "commission_payouts_loan_application_id_idx" ON "commission_payouts"("loan_application_id");
CREATE INDEX "commission_payouts_status_idx" ON "commission_payouts"("status");
CREATE INDEX "commission_payouts_paid_at_idx" ON "commission_payouts"("paid_at");

-- Commission audit events
CREATE TABLE "commission_audit_events" (
    "id" UUID NOT NULL,
    "broker_org_id" UUID NOT NULL,
    "loan_application_id" UUID,
    "deal_commission_id" UUID,
    "commission_invoice_id" UUID,
    "commission_payout_id" UUID,
    "event_type" "CommissionAuditEventType" NOT NULL,
    "actor_user_id" UUID,
    "actor_type" "CommissionAuditActorType" NOT NULL DEFAULT 'USER',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_audit_events_broker_org_id_idx" ON "commission_audit_events"("broker_org_id");
CREATE INDEX "commission_audit_events_loan_application_id_idx" ON "commission_audit_events"("loan_application_id");
CREATE INDEX "commission_audit_events_deal_commission_id_idx" ON "commission_audit_events"("deal_commission_id");
CREATE INDEX "commission_audit_events_event_type_idx" ON "commission_audit_events"("event_type");
CREATE INDEX "commission_audit_events_created_at_idx" ON "commission_audit_events"("created_at");

-- Migrate legacy invoice numbers into commission_invoices
INSERT INTO "commission_invoices" (
    "id",
    "deal_commission_id",
    "broker_org_id",
    "loan_application_id",
    "invoice_number",
    "status",
    "generated_at",
    "generated_by_user_id",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    dc."id",
    dc."broker_org_id",
    dc."loan_application_id",
    dc."invoice_number",
    'GENERATED'::"CommissionInvoiceStatus",
    COALESCE(dc."calculated_at", dc."created_at"),
    dc."paid_by_user_id",
    dc."created_at",
    dc."updated_at"
FROM "deal_commissions" dc
WHERE dc."invoice_number" IS NOT NULL AND dc."invoice_number" <> '';

-- Migrate legacy paid rows into commission_payouts
INSERT INTO "commission_payouts" (
    "id",
    "deal_commission_id",
    "commission_invoice_id",
    "broker_org_id",
    "loan_application_id",
    "amount",
    "payment_method",
    "payment_reference",
    "notes",
    "status",
    "paid_at",
    "paid_by_user_id",
    "created_at"
)
SELECT
    gen_random_uuid(),
    dc."id",
    ci."id",
    dc."broker_org_id",
    dc."loan_application_id",
    dc."commission_amount",
    COALESCE(dc."payment_method", 'MANUAL'::"CommissionPaymentMethod"),
    NULL,
    dc."payment_notes",
    'COMPLETED'::"CommissionPayoutStatus",
    COALESCE(dc."paid_at", dc."updated_at"),
    COALESCE(
        dc."paid_by_user_id",
        (
            SELECT ua."id"
            FROM "user_accounts" ua
            INNER JOIN "user_roles" ur ON ur."userId" = ua."id"
            INNER JOIN "roles" r ON r."id" = ur."roleId"
            WHERE ua."organizationId" = dc."broker_org_id"
              AND r."name" = 'BROKER_ADMIN'
              AND ua."is_deleted" = false
            ORDER BY ua."createdAt" ASC
            LIMIT 1
        )
    ),
    COALESCE(dc."paid_at", dc."created_at")
FROM "deal_commissions" dc
LEFT JOIN "commission_invoices" ci ON ci."deal_commission_id" = dc."id"
WHERE dc."status" = 'PAID'
  AND COALESCE(
        dc."paid_by_user_id",
        (
            SELECT ua."id"
            FROM "user_accounts" ua
            INNER JOIN "user_roles" ur ON ur."userId" = ua."id"
            INNER JOIN "roles" r ON r."id" = ur."roleId"
            WHERE ua."organizationId" = dc."broker_org_id"
              AND r."name" = 'BROKER_ADMIN'
              AND ua."is_deleted" = false
            ORDER BY ua."createdAt" ASC
            LIMIT 1
        )
      ) IS NOT NULL;

-- Add calculation_version and line status columns
ALTER TABLE "deal_commissions" ADD COLUMN IF NOT EXISTS "calculation_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "deal_commissions" ADD COLUMN IF NOT EXISTS "line_status" "CommissionLineStatus" NOT NULL DEFAULT 'CALCULATED';

UPDATE "deal_commissions"
SET "line_status" = 'CALCULATED'
WHERE "status" IN ('PENDING', 'PAID', 'PROCESSING', 'FAILED');

-- Drop legacy payment/invoice columns from deal_commissions
ALTER TABLE "deal_commissions" DROP CONSTRAINT IF EXISTS "deal_commissions_paid_by_user_id_fkey";
DROP INDEX IF EXISTS "deal_commissions_invoice_number_key";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "invoice_number";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "payment_method";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "payment_notes";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "paid_at";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "paid_by_user_id";
ALTER TABLE "deal_commissions" DROP COLUMN IF EXISTS "status";
ALTER TABLE "deal_commissions" RENAME COLUMN "line_status" TO "status";

-- Foreign keys
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_deal_commission_id_fkey" FOREIGN KEY ("deal_commission_id") REFERENCES "deal_commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_broker_org_id_fkey" FOREIGN KEY ("broker_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_deal_commission_id_fkey" FOREIGN KEY ("deal_commission_id") REFERENCES "deal_commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_commission_invoice_id_fkey" FOREIGN KEY ("commission_invoice_id") REFERENCES "commission_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_broker_org_id_fkey" FOREIGN KEY ("broker_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_broker_org_id_fkey" FOREIGN KEY ("broker_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_deal_commission_id_fkey" FOREIGN KEY ("deal_commission_id") REFERENCES "deal_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_commission_invoice_id_fkey" FOREIGN KEY ("commission_invoice_id") REFERENCES "commission_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_commission_payout_id_fkey" FOREIGN KEY ("commission_payout_id") REFERENCES "commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_audit_events" ADD CONSTRAINT "commission_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy commission status enum if unused
DROP TYPE IF EXISTS "CommissionStatus";
