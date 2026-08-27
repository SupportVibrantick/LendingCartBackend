-- CreateTable
CREATE TABLE "sign_form_library_templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SignFormStatus" NOT NULL DEFAULT 'PUBLISHED',
    "template_file_name" TEXT NOT NULL,
    "template_file_url" TEXT NOT NULL,
    "template_mime_type" TEXT,
    "schema_json" JSONB NOT NULL,
    "page_manifest_json" JSONB,
    "source_requirement_id" UUID,
    "created_by_user_id" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sign_form_library_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sign_form_library_templates_organizationId_status_idx" ON "sign_form_library_templates"("organizationId", "status");

-- CreateIndex
CREATE INDEX "sign_form_library_templates_created_by_user_id_idx" ON "sign_form_library_templates"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "sign_form_library_templates" ADD CONSTRAINT "sign_form_library_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_form_library_templates" ADD CONSTRAINT "sign_form_library_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
