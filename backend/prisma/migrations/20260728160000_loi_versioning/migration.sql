-- LOI versioning: preserve all lender/broker LOI versions for audit trail

CREATE TABLE "lender_loi_versions" (
    "id" UUID NOT NULL,
    "application_lender_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "loi_url" TEXT NOT NULL,
    "loi_terms_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sent_to_broker_at" TIMESTAMPTZ(6),
    "generated_by_user_id" UUID,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(6),

    CONSTRAINT "lender_loi_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lender_loi_versions_application_lender_id_version_number_key"
    ON "lender_loi_versions"("application_lender_id", "version_number");
CREATE INDEX "lender_loi_versions_application_lender_id_idx"
    ON "lender_loi_versions"("application_lender_id");

ALTER TABLE "lender_loi_versions"
    ADD CONSTRAINT "lender_loi_versions_application_lender_id_fkey"
    FOREIGN KEY ("application_lender_id") REFERENCES "application_lenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lender_loi_versions"
    ADD CONSTRAINT "lender_loi_versions_generated_by_user_id_fkey"
    FOREIGN KEY ("generated_by_user_id") REFERENCES "user_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "broker_loi_versions" (
    "id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "source_application_lender_id" UUID,
    "source_lender_loi_version_id" UUID,
    "version_number" INTEGER NOT NULL,
    "broker_loi_url" TEXT NOT NULL,
    "broker_loi_terms" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sent_to_client_at" TIMESTAMPTZ(6),
    "client_signed_at" TIMESTAMPTZ(6),
    "signed_pdf_url" TEXT,
    "document_requirement_id" UUID,
    "generated_by_user_id" UUID,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(6),

    CONSTRAINT "broker_loi_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broker_loi_versions_loan_application_id_version_number_key"
    ON "broker_loi_versions"("loan_application_id", "version_number");
CREATE INDEX "broker_loi_versions_loan_application_id_idx"
    ON "broker_loi_versions"("loan_application_id");

ALTER TABLE "broker_loi_versions"
    ADD CONSTRAINT "broker_loi_versions_loan_application_id_fkey"
    FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broker_loi_versions"
    ADD CONSTRAINT "broker_loi_versions_source_lender_loi_version_id_fkey"
    FOREIGN KEY ("source_lender_loi_version_id") REFERENCES "lender_loi_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "broker_loi_versions"
    ADD CONSTRAINT "broker_loi_versions_generated_by_user_id_fkey"
    FOREIGN KEY ("generated_by_user_id") REFERENCES "user_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_lenders"
    ADD COLUMN "current_lender_loi_version_id" UUID;

CREATE UNIQUE INDEX "application_lenders_current_lender_loi_version_id_key"
    ON "application_lenders"("current_lender_loi_version_id");

ALTER TABLE "application_lenders"
    ADD CONSTRAINT "application_lenders_current_lender_loi_version_id_fkey"
    FOREIGN KEY ("current_lender_loi_version_id") REFERENCES "lender_loi_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_applications"
    ADD COLUMN "current_broker_loi_version_id" UUID;

CREATE UNIQUE INDEX "loan_applications_current_broker_loi_version_id_key"
    ON "loan_applications"("current_broker_loi_version_id");

ALTER TABLE "loan_applications"
    ADD CONSTRAINT "loan_applications_current_broker_loi_version_id_fkey"
    FOREIGN KEY ("current_broker_loi_version_id") REFERENCES "broker_loi_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing lender LOIs as Version 1
INSERT INTO "lender_loi_versions" (
    "id",
    "application_lender_id",
    "version_number",
    "loi_url",
    "loi_terms_json",
    "status",
    "sent_to_broker_at",
    "generated_at"
)
SELECT
    gen_random_uuid(),
    al."id",
    1,
    al."loiUrl",
    al."loi_terms_json",
    CASE
        WHEN al."loi_sent_to_broker_at" IS NOT NULL THEN 'SENT_TO_BROKER'
        ELSE 'DRAFT'
    END,
    al."loi_sent_to_broker_at",
    COALESCE(al."lastUpdatedAt", al."sentAt", CURRENT_TIMESTAMP)
FROM "application_lenders" al
WHERE al."loiUrl" IS NOT NULL;

UPDATE "application_lenders" al
SET "current_lender_loi_version_id" = lv."id"
FROM "lender_loi_versions" lv
WHERE lv."application_lender_id" = al."id"
  AND lv."version_number" = 1
  AND al."loiUrl" IS NOT NULL;

-- Backfill existing broker LOIs as Version 1
INSERT INTO "broker_loi_versions" (
    "id",
    "loan_application_id",
    "source_application_lender_id",
    "version_number",
    "broker_loi_url",
    "broker_loi_terms",
    "status",
    "generated_at",
    "generated_by_user_id"
)
SELECT
    gen_random_uuid(),
    la."id",
    la."broker_loi_source_application_lender_id",
    1,
    la."broker_loi_url",
    la."broker_loi_terms",
    'DRAFT',
    COALESCE(la."broker_loi_generated_at", la."updatedAt", CURRENT_TIMESTAMP),
    la."broker_loi_generated_by_user_id"
FROM "loan_applications" la
WHERE la."broker_loi_url" IS NOT NULL;

UPDATE "loan_applications" la
SET "current_broker_loi_version_id" = bv."id"
FROM "broker_loi_versions" bv
WHERE bv."loan_application_id" = la."id"
  AND bv."version_number" = 1
  AND la."broker_loi_url" IS NOT NULL;
