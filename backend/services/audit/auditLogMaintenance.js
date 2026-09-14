const {
  getAuditLogRetentionDays,
} = require("../../config/env");

function isMissingDbObjectError(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("ensure_audit_log_partition") ||
    msg.includes("drop_expired_audit_log_partitions") ||
    msg.includes("does not exist") ||
    err?.code === "42883" ||
    err?.code === "42P01"
  );
}

/**
 * Ensure monthly RANGE partitions exist on audit_logs (current ± offsets).
 * Safe no-op when the table is not partitioned or helpers are not migrated yet.
 */
async function ensureAuditLogPartitions(prisma, log = console) {
  const months = [-1, 0, 1, 2];
  const created = [];

  try {
    for (const offset of months) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT ensure_audit_log_partition(($1::int)) AS partition_name`,
        offset,
      );
      const name = result?.[0]?.partition_name;
      if (name) created.push(name);
    }
  } catch (err) {
    if (isMissingDbObjectError(err)) {
      if (log?.warn) {
        log.warn(
          "AuditLog partition helpers missing — run prisma migrate for audit_log_monthly_partitions",
        );
      }
      return { partitions: [], skipped: true };
    }
    throw err;
  }

  if (log?.info) {
    log.info({ partitions: created }, "AuditLog partitions ensured");
  }

  return { partitions: created };
}

/**
 * Delete expired rows (and drop old partitions when partitioned).
 */
async function purgeExpiredAuditLogs(prisma, log = console) {
  const retentionDays = getAuditLogRetentionDays();
  let droppedPartitions = 0;

  try {
    const dropped = await prisma.$queryRawUnsafe(
      `SELECT drop_expired_audit_log_partitions($1::int) AS dropped_count`,
      retentionDays,
    );
    droppedPartitions = Number(dropped?.[0]?.dropped_count) || 0;
  } catch (err) {
    if (!isMissingDbObjectError(err)) {
      throw err;
    }
  }

  let deleted = 0;
  const batchSize = 1000;
  for (let i = 0; i < 50; i += 1) {
    const batch = await prisma.$executeRawUnsafe(
      `WITH doomed AS (
         SELECT id, "createdAt"
         FROM audit_logs
         WHERE "createdAt" < NOW() - ($1::text || ' days')::interval
         LIMIT $2
       )
       DELETE FROM audit_logs a
       USING doomed d
       WHERE a.id = d.id AND a."createdAt" = d."createdAt"`,
      String(retentionDays),
      batchSize,
    );
    deleted += Number(batch) || 0;
    if (!batch || batch < batchSize) break;
  }

  if (log?.info) {
    log.info(
      {
        retentionDays,
        deletedRows: deleted,
        droppedPartitions,
      },
      "AuditLog retention purge completed",
    );
  }

  return {
    retentionDays,
    deletedRows: deleted,
    droppedPartitions,
  };
}

async function runAuditLogMaintenance(prisma, log = console) {
  const partitions = await ensureAuditLogPartitions(prisma, log);
  const purge = await purgeExpiredAuditLogs(prisma, log);
  return { ...partitions, ...purge };
}

module.exports = {
  ensureAuditLogPartitions,
  purgeExpiredAuditLogs,
  runAuditLogMaintenance,
};
