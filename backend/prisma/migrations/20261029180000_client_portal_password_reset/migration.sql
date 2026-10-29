-- Client portal forgot-password reset tokens (separate from broker UserAccount tokens).
CREATE TABLE "client_portal_password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_portal_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_portal_password_reset_tokens_token_key"
  ON "client_portal_password_reset_tokens"("token");

CREATE INDEX "client_portal_password_reset_tokens_userId_idx"
  ON "client_portal_password_reset_tokens"("userId");

CREATE INDEX "client_portal_password_reset_tokens_token_idx"
  ON "client_portal_password_reset_tokens"("token");

ALTER TABLE "client_portal_password_reset_tokens"
  ADD CONSTRAINT "client_portal_password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "client_portal_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
