const cron = require("node-cron");
const { runCronJob } = require("../services/jobs");
const { processDueDocumentReminders } = require("../services/documents/documentReminderService");

const JOB_NAME = "document-reminders";
const LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * Processes scheduled document reminder emails every minute.
 */
function runDocumentReminderScheduler(fastify) {
  fastify.log.info("Document reminder scheduler initialized");

  cron.schedule("* * * * *", async () => {
    try {
      await runCronJob({
        prisma: fastify.prisma,
        log: fastify.log,
        jobName: JOB_NAME,
        ttlMs: LOCK_TTL_MS,
        handler: () =>
          processDueDocumentReminders(fastify.prisma, fastify.io),
      });
    } catch (error) {
      fastify.log.error({ err: error }, "Document reminder scheduler failed");
    }
  });
}

module.exports = runDocumentReminderScheduler;
