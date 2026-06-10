const cron = require("node-cron");
const { runSubscriptionBillingCycle } = require("../services/subscriptionBilling");
const { sendTrialEndingReminders } = require("../services/subscriptionTrialReminder");

/**
 * Processes trial-ending reminders, expired trials, and overdue subscription invoices.
 * Runs every 15 minutes.
 */
function runSubscriptionScheduler(fastify) {
  console.log("📋 Subscription billing scheduler initialized");

  cron.schedule("*/15 * * * *", async () => {
    try {
      const reminders = await sendTrialEndingReminders(fastify.prisma, fastify.io);
      const result = await runSubscriptionBillingCycle(fastify.prisma);

      if (reminders.sent > 0 || reminders.failed > 0) {
        fastify.log.info(reminders, "Trial ending reminder cycle completed");
      }

      if (result.expiredTrials > 0 || result.pastDue > 0) {
        fastify.log.info(
          {
            expiredTrials: result.expiredTrials,
            pastDue: result.pastDue,
          },
          "Subscription billing cycle completed",
        );
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Subscription billing scheduler failed");
    }
  });
}

module.exports = runSubscriptionScheduler;
