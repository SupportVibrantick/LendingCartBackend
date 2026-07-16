-- Backfill legacy accounts so the hard email gate only blocks
-- newly unverified public partner signups (and anyone with a pending token).
UPDATE "user_accounts" AS ua
SET "email_verified_at" = COALESCE(ua."createdAt", CURRENT_TIMESTAMP)
WHERE ua."email_verified_at" IS NULL
  AND ua."is_deleted" IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM "email_verification_tokens" AS evt
    WHERE evt."userId" = ua."id"
      AND evt."usedAt" IS NULL
      AND evt."expiresAt" > CURRENT_TIMESTAMP
  );
