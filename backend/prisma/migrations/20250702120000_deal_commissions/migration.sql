-- CreateEnum
CREATE TYPE "CommissionRecipientRole" AS ENUM ('LOAN_OFFICER', 'CO_BROKER');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionPaymentMethod" AS ENUM ('MANUAL', 'STRIPE');

-- CreateTable
CREATE TABLE "deal_commissions" (
    "id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "broker_org_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "recipient_role" "CommissionRecipientRole" NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "loan_amount" DECIMAL(20,2) NOT NULL,
    "broker_points" DECIMAL(5,2),
    "upfront_fee" DECIMAL(12,2),
    "commission_pool" DECIMAL(20,2) NOT NULL,
    "finders_fee_percent" DECIMAL(5,2) NOT NULL,
    "commission_amount" DECIMAL(20,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "CommissionPaymentMethod",
    "payment_notes" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "paid_by_user_id" UUID,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deal_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_commissions_invoice_number_key" ON "deal_commissions"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "deal_commissions_loan_application_id_recipient_user_id_recipi_key" ON "deal_commissions"("loan_application_id", "recipient_user_id", "recipient_role");

-- CreateIndex
CREATE INDEX "deal_commissions_broker_org_id_idx" ON "deal_commissions"("broker_org_id");

-- CreateIndex
CREATE INDEX "deal_commissions_recipient_user_id_idx" ON "deal_commissions"("recipient_user_id");

-- CreateIndex
CREATE INDEX "deal_commissions_status_idx" ON "deal_commissions"("status");

-- CreateIndex
CREATE INDEX "deal_commissions_loan_application_id_idx" ON "deal_commissions"("loan_application_id");

-- AddForeignKey
ALTER TABLE "deal_commissions" ADD CONSTRAINT "deal_commissions_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_commissions" ADD CONSTRAINT "deal_commissions_broker_org_id_fkey" FOREIGN KEY ("broker_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_commissions" ADD CONSTRAINT "deal_commissions_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_commissions" ADD CONSTRAINT "deal_commissions_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
