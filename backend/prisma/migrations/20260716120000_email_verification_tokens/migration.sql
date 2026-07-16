-- AlterTable
ALTER TABLE "user_accounts"
ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_key"
ON "email_verification_tokens"("token");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx"
ON "email_verification_tokens"("userId");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx"
ON "email_verification_tokens"("token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verification_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
