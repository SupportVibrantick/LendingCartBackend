const cron = require("node-cron");
const { runCronJob } = require("../services/jobs");
const { runSubscriptionBillingCycle } = require("../services/subscription/subscriptionBilling");
const { sendTrialEndingReminders } = require("../services/subscription/subscriptionTrialReminder");

const JOB_NAME = "subscription-billing";
const LOCK_TTL_MS = 14 * 60 * 1000;

/**
 * Processes trial-ending reminders, expired trials, and overdue subscription invoices.
 * Runs every 15 minutes.
 */
function runSubscriptionScheduler(fastify) {
  fastify.log.info("Subscription billing scheduler initialized");

  cron.schedule("*/15 * * * *", async () => {
    try {
      await runCronJob({
        prisma: fastify.prisma,
        log: fastify.log,
        jobName: JOB_NAME,
        ttlMs: LOCK_TTL_MS,
        handler: async () => {
          const reminders = await sendTrialEndingReminders(
            fastify.prisma,
            fastify.io,
          );
          const billing = await runSubscriptionBillingCycle(fastify.prisma);

          return {
            trialRemindersSent: reminders.sent,
            trialRemindersFailed: reminders.failed,
            trialRemindersSkipped: reminders.skipped,
            expiredTrials: billing.expiredTrials,
            pastDue: billing.pastDue,
          };
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, "Subscription billing scheduler failed");
    }
  });
}

module.exports = runSubscriptionScheduler;
