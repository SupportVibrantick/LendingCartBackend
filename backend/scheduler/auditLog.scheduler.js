const cron = require("node-cron");
const { runCronJob } = require("../services/jobs");
const { runAuditLogMaintenance } = require("../services/audit/auditLogMaintenance");

const JOB_NAME = "audit-log-maintenance";
const LOCK_TTL_MS = 55 * 60 * 1000;

/**
 * Ensures monthly AuditLog partitions and enforces the retention policy.
 * Runs daily at 03:15 UTC.
 */
function runAuditLogScheduler(fastify) {
  fastify.log.info("AuditLog maintenance scheduler initialized");

  cron.schedule("15 3 * * *", async () => {
    try {
      await runCronJob({
        prisma: fastify.prisma,
        log: fastify.log,
        jobName: JOB_NAME,
        ttlMs: LOCK_TTL_MS,
        handler: () => runAuditLogMaintenance(fastify.prisma, fastify.log),
      });
    } catch (error) {
      fastify.log.error({ err: error }, "AuditLog maintenance scheduler failed");
    }
  });
}

module.exports = runAuditLogScheduler;
