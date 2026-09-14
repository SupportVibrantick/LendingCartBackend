-- Convert audit_logs to monthly RANGE partitions + retention helpers.
-- Primary key becomes (id, "createdAt") so PostgreSQL partitioning rules are satisfied.
-- Prisma model uses @@id([id, createdAt]).

DO $$
DECLARE
  is_partitioned boolean;
  min_created timestamptz;
  cursor_month date;
  end_month date;
  part_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs'
  ) INTO is_partitioned;

  IF NOT is_partitioned THEN
    ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actorOrgId_fkey";
    ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actorUserId_fkey";

    ALTER TABLE "audit_logs" RENAME TO "audit_logs_legacy";

    -- Renamed table keeps index/constraint names; free them for the new parent.
    ALTER TABLE "audit_logs_legacy" RENAME CONSTRAINT "audit_logs_pkey" TO "audit_logs_legacy_pkey";
    ALTER INDEX IF EXISTS "audit_logs_actorOrgId_idx" RENAME TO "audit_logs_legacy_actorOrgId_idx";
    ALTER INDEX IF EXISTS "audit_logs_dashboard_idx" RENAME TO "audit_logs_legacy_dashboard_idx";
    ALTER INDEX IF EXISTS "audit_logs_createdAt_idx" RENAME TO "audit_logs_legacy_createdAt_idx";
    ALTER INDEX IF EXISTS "audit_logs_entityId_idx" RENAME TO "audit_logs_legacy_entityId_idx";
    ALTER INDEX IF EXISTS "audit_logs_entityType_createdAt_idx" RENAME TO "audit_logs_legacy_entityType_createdAt_idx";

    CREATE TABLE "audit_logs" (
      "id" UUID NOT NULL,
      "actorUserId" UUID,
      "actorOrgId" UUID,
      "dashboard" "DashboardType" NOT NULL,
      "category" "LogCategory" NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "oldValueJson" TEXT,
      "newValueJson" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "createdAt")
    ) PARTITION BY RANGE ("createdAt");

    SELECT COALESCE(date_trunc('month', MIN("createdAt")), date_trunc('month', NOW()))
    INTO min_created
    FROM "audit_logs_legacy";

    cursor_month := min_created::date;
    end_month := (date_trunc('month', NOW()) + INTERVAL '3 months')::date;

    WHILE cursor_month < end_month LOOP
      part_name := 'audit_logs_y' || to_char(cursor_month, 'YYYY') || 'm' || to_char(cursor_month, 'MM');
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
        part_name,
        cursor_month,
        (cursor_month + INTERVAL '1 month')::date
      );
      cursor_month := (cursor_month + INTERVAL '1 month')::date;
    END LOOP;

    CREATE TABLE IF NOT EXISTS "audit_logs_default" PARTITION OF "audit_logs" DEFAULT;

    INSERT INTO "audit_logs" (
      "id", "actorUserId", "actorOrgId", "dashboard", "category",
      "entityType", "entityId", "action", "oldValueJson", "newValueJson",
      "ipAddress", "userAgent", "createdAt"
    )
    SELECT
      "id", "actorUserId", "actorOrgId", "dashboard", "category",
      "entityType", "entityId", "action", "oldValueJson", "newValueJson",
      "ipAddress", "userAgent", "createdAt"
    FROM "audit_logs_legacy";

    CREATE INDEX IF NOT EXISTS "audit_logs_actorOrgId_idx" ON "audit_logs"("actorOrgId");
    CREATE INDEX IF NOT EXISTS "audit_logs_dashboard_idx" ON "audit_logs"("dashboard");
    CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
    CREATE INDEX IF NOT EXISTS "audit_logs_entityId_idx" ON "audit_logs"("entityId");
    CREATE INDEX IF NOT EXISTS "audit_logs_entityType_createdAt_idx" ON "audit_logs"("entityType", "createdAt");

    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_actorOrgId_fkey"
      FOREIGN KEY ("actorOrgId") REFERENCES "organizations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "user_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;

    DROP TABLE "audit_logs_legacy";
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_audit_log_partition(month_offset integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
  part_name text;
  is_partitioned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs'
  ) INTO is_partitioned;

  IF NOT is_partitioned THEN
    RETURN NULL;
  END IF;

  start_date := date_trunc('month', CURRENT_DATE + make_interval(months => month_offset))::date;
  end_date := (start_date + INTERVAL '1 month')::date;
  part_name := 'audit_logs_y' || to_char(start_date, 'YYYY') || 'm' || to_char(start_date, 'MM');

  IF to_regclass(format('public.%I', part_name)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
      part_name,
      start_date,
      end_date
    );
  END IF;

  RETURN part_name;
END;
$$;

CREATE OR REPLACE FUNCTION drop_expired_audit_log_partitions(retention_days integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff date;
  r record;
  dropped integer := 0;
  part_start date;
  is_partitioned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs'
  ) INTO is_partitioned;

  IF NOT is_partitioned THEN
    RETURN 0;
  END IF;

  cutoff := date_trunc('month', CURRENT_DATE - make_interval(days => retention_days))::date;

  FOR r IN
    SELECT c.relname AS partition_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname = 'audit_logs'
      AND c.relname ~ '^audit_logs_y[0-9]{4}m[0-9]{2}$'
  LOOP
    part_start := make_date(
      substring(r.partition_name from 'y([0-9]{4})')::int,
      substring(r.partition_name from 'm([0-9]{2})$')::int,
      1
    );
    IF part_start < cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS %I', r.partition_name);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  RETURN dropped;
END;
$$;
