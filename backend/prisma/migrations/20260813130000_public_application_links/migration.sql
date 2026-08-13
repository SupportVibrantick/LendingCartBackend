-- CreateEnum
CREATE TYPE "PublicApplicationLinkSourcePortal" AS ENUM ('BROKER', 'LOAN_OFFICER', 'CO_BROKER');

-- CreateEnum
CREATE TYPE "PublicApplicationSourcePortal" AS ENUM ('BROKER', 'LOAN_OFFICER', 'CO_BROKER', 'LEGACY');

-- CreateTable
CREATE TABLE "public_application_links" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "broker_organization_id" UUID NOT NULL,
    "source_portal" "PublicApplicationLinkSourcePortal" NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "loan_officer_id" UUID,
    "co_broker_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_application_links_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "loan_applications"
ADD COLUMN "public_application_link_id" UUID,
ADD COLUMN "public_source_portal" "PublicApplicationSourcePortal",
ADD COLUMN "public_created_by_user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "public_application_links_token_key" ON "public_application_links"("token");

-- CreateIndex
CREATE INDEX "public_application_links_broker_organization_id_idx" ON "public_application_links"("broker_organization_id");

-- CreateIndex
CREATE INDEX "public_application_links_created_by_user_id_idx" ON "public_application_links"("created_by_user_id");

-- CreateIndex
CREATE INDEX "public_application_links_source_portal_idx" ON "public_application_links"("source_portal");

-- CreateIndex
CREATE INDEX "public_application_links_is_active_idx" ON "public_application_links"("is_active");

-- CreateIndex
CREATE INDEX "loan_applications_public_application_link_id_idx" ON "loan_applications"("public_application_link_id");

-- CreateIndex
CREATE INDEX "loan_applications_public_source_portal_idx" ON "loan_applications"("public_source_portal");

-- AddForeignKey
ALTER TABLE "public_application_links"
ADD CONSTRAINT "public_application_links_broker_organization_id_fkey"
FOREIGN KEY ("broker_organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_application_links"
ADD CONSTRAINT "public_application_links_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "user_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_application_links"
ADD CONSTRAINT "public_application_links_loan_officer_id_fkey"
FOREIGN KEY ("loan_officer_id") REFERENCES "user_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_application_links"
ADD CONSTRAINT "public_application_links_co_broker_id_fkey"
FOREIGN KEY ("co_broker_id") REFERENCES "user_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications"
ADD CONSTRAINT "loan_applications_public_application_link_id_fkey"
FOREIGN KEY ("public_application_link_id") REFERENCES "public_application_links"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications"
ADD CONSTRAINT "loan_applications_public_created_by_user_id_fkey"
FOREIGN KEY ("public_created_by_user_id") REFERENCES "user_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
