-- Admin-managed org feature keys (permissions + loan categories/types).
-- Null = derive defaults from package code + purchased add-ons.
ALTER TABLE "organization_subscriptions"
ADD COLUMN IF NOT EXISTS "enabled_features" JSONB;
