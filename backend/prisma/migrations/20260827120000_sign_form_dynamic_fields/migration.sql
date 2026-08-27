-- CreateEnum
CREATE TYPE "SignDocumentMode" AS ENUM ('SIGNATURE_ONLY', 'DYNAMIC_FORM');

-- CreateEnum
CREATE TYPE "SignFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SignFormProcessingStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SignFormSubmissionStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SignFormFillRole" AS ENUM ('CLIENT', 'BROKER');

-- AlterTable
ALTER TABLE "application_document_requirements"
ADD COLUMN "sign_mode" "SignDocumentMode" NOT NULL DEFAULT 'SIGNATURE_ONLY',
ADD COLUMN "form_processing_status" "SignFormProcessingStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "active_form_version_id" UUID;

-- CreateTable
CREATE TABLE "sign_form_definitions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SignFormStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sign_form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_form_versions" (
    "id" UUID NOT NULL,
    "formDefinitionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SignFormStatus" NOT NULL DEFAULT 'DRAFT',
    "schema_json" JSONB NOT NULL,
    "page_manifest_json" JSONB,
    "published_at" TIMESTAMPTZ(6),
    "published_by_user_id" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sign_form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_form_submissions" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "formVersionId" UUID NOT NULL,
    "status" "SignFormSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by_client_user_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sign_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_form_submission_values" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "filled_by_role" "SignFormFillRole" NOT NULL,
    "filled_by_user_id" UUID,
    "filled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sign_form_submission_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sign_form_definitions_requirementId_key" ON "sign_form_definitions"("requirementId");

-- CreateIndex
CREATE INDEX "sign_form_definitions_organizationId_idx" ON "sign_form_definitions"("organizationId");

-- CreateIndex
CREATE INDEX "sign_form_versions_formDefinitionId_idx" ON "sign_form_versions"("formDefinitionId");

-- CreateIndex
CREATE INDEX "sign_form_versions_status_idx" ON "sign_form_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sign_form_versions_formDefinitionId_version_key" ON "sign_form_versions"("formDefinitionId", "version");

-- CreateIndex
CREATE INDEX "sign_form_submissions_requirementId_idx" ON "sign_form_submissions"("requirementId");

-- CreateIndex
CREATE INDEX "sign_form_submissions_formVersionId_idx" ON "sign_form_submissions"("formVersionId");

-- CreateIndex
CREATE INDEX "sign_form_submissions_status_idx" ON "sign_form_submissions"("status");

-- CreateIndex
CREATE INDEX "sign_form_submission_values_submissionId_idx" ON "sign_form_submission_values"("submissionId");

-- CreateIndex
CREATE INDEX "sign_form_submission_values_field_key_idx" ON "sign_form_submission_values"("field_key");

-- CreateIndex
CREATE UNIQUE INDEX "sign_form_submission_values_submissionId_field_key_key" ON "sign_form_submission_values"("submissionId", "field_key");

-- CreateIndex
CREATE INDEX "application_document_requirements_active_form_version_id_idx" ON "application_document_requirements"("active_form_version_id");

-- AddForeignKey
ALTER TABLE "sign_form_definitions" ADD CONSTRAINT "sign_form_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_definitions" ADD CONSTRAINT "sign_form_definitions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "application_document_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_versions" ADD CONSTRAINT "sign_form_versions_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "sign_form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_versions" ADD CONSTRAINT "sign_form_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_requirements" ADD CONSTRAINT "application_document_requirements_active_form_version_id_fkey" FOREIGN KEY ("active_form_version_id") REFERENCES "sign_form_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_submissions" ADD CONSTRAINT "sign_form_submissions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "application_document_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_submissions" ADD CONSTRAINT "sign_form_submissions_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "sign_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_submissions" ADD CONSTRAINT "sign_form_submissions_submitted_by_client_user_id_fkey" FOREIGN KEY ("submitted_by_client_user_id") REFERENCES "client_portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_submission_values" ADD CONSTRAINT "sign_form_submission_values_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "sign_form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_submission_values" ADD CONSTRAINT "sign_form_submission_values_filled_by_user_id_fkey" FOREIGN KEY ("filled_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
