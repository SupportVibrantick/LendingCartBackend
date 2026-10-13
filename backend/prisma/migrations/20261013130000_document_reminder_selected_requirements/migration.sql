-- Allow brokers to choose which document requirements a reminder schedule targets.
ALTER TABLE "document_reminder_schedules"
ADD COLUMN IF NOT EXISTS "selected_requirement_ids" JSONB;
