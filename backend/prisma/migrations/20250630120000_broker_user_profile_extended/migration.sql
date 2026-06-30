-- Extend broker_user_profiles for loan officer extended profile data
ALTER TABLE "broker_user_profiles"
  ADD COLUMN IF NOT EXISTS "w9Url" TEXT,
  ADD COLUMN IF NOT EXISTS "profileData" JSONB;
