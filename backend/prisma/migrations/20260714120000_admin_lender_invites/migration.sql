-- CreateEnum
CREATE TYPE "AdminLenderInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "admin_lender_invites" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "status" "AdminLenderInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by_admin_id" UUID,
    "lender_org_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_lender_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_lender_invites_token_key" ON "admin_lender_invites"("token");

-- CreateIndex
CREATE INDEX "admin_lender_invites_email_idx" ON "admin_lender_invites"("email");

-- CreateIndex
CREATE INDEX "admin_lender_invites_status_idx" ON "admin_lender_invites"("status");

-- CreateIndex
CREATE INDEX "admin_lender_invites_expires_at_idx" ON "admin_lender_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "admin_lender_invites"
ADD CONSTRAINT "admin_lender_invites_lender_org_id_fkey"
FOREIGN KEY ("lender_org_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
