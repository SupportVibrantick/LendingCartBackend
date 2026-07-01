-- AlterTable
ALTER TABLE "loan_applications"
ADD COLUMN "funded_application_lender_id" UUID,
ADD COLUMN "funded_at" TIMESTAMPTZ(6),
ADD COLUMN "funded_by_user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_funded_application_lender_id_key"
ON "loan_applications"("funded_application_lender_id");

CREATE INDEX "loan_applications_funded_by_user_id_idx"
ON "loan_applications"("funded_by_user_id");

-- AddForeignKey
ALTER TABLE "loan_applications"
ADD CONSTRAINT "loan_applications_funded_application_lender_id_fkey"
FOREIGN KEY ("funded_application_lender_id") REFERENCES "application_lenders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_applications"
ADD CONSTRAINT "loan_applications_funded_by_user_id_fkey"
FOREIGN KEY ("funded_by_user_id") REFERENCES "user_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
