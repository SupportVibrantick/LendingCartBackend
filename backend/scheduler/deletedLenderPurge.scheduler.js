const cron = require("node-cron");
const { runCronJob } = require("../services/jobs");
const {
  purgeExpiredDeletedLenders,
} = require("../services/lenders/purgeExpiredDeletedLenders");

const JOB_NAME = "deleted-lender-purge";
const LOCK_TTL_MS = 55 * 60 * 1000;

/**
 * Permanently deletes soft-deleted lenders older than retention (default 30 days).
 * Runs daily at 03:45 UTC.
 */
function runDeletedLenderPurgeScheduler(fastify) {
  fastify.log.info("Deleted lender purge scheduler initialized");

  cron.schedule("45 3 * * *", async () => {
    try {
      await runCronJob({
        prisma: fastify.prisma,
        log: fastify.log,
        jobName: JOB_NAME,
        ttlMs: LOCK_TTL_MS,
        handler: () => purgeExpiredDeletedLenders(fastify.prisma, {
          log: fastify.log,
        }),
      });
    } catch (error) {
      fastify.log.error(
        { err: error },
        "Deleted lender purge scheduler failed",
      );
    }
  });
}

module.exports = runDeletedLenderPurgeScheduler;
