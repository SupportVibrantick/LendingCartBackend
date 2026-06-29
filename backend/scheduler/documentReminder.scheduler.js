const cron = require("node-cron");
const {
  processDueDocumentReminders,
} = require("../services/documentReminderService");

/**
 * Processes scheduled document reminder emails every minute.
 */
function runDocumentReminderScheduler(fastify) {
  console.log("📧 Document reminder scheduler initialized");

  cron.schedule("* * * * *", async () => {
    try {
      const result = await processDueDocumentReminders(
        fastify.prisma,
        fastify.io,
      );

      if (result.sent > 0 || result.completed > 0 || result.failed > 0) {
        fastify.log.info(result, "Document reminder cycle completed");
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Document reminder scheduler failed");
    }
  });
}

module.exports = runDocumentReminderScheduler;
