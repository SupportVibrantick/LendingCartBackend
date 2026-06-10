const { adminLogs } = require("../../../../services/logger/contextLogger");
const { runSubscriptionBillingCycle } = require("../../../../services/subscriptionBilling");
const { sendTrialEndingReminders } = require("../../../../services/subscriptionTrialReminder");

async function processBillingRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Run subscription billing cycle (expire trials, mark past due)",
      },
    },
    async (_req, reply) => {
      const prisma = fastify.prisma;
      try {
        const reminders = await sendTrialEndingReminders(prisma, fastify.io);
        const result = await runSubscriptionBillingCycle(prisma);

        adminLogs.info("Subscription billing cycle run manually", {
          trialRemindersSent: reminders.sent,
          expiredTrials: result.expiredTrials,
          pastDue: result.pastDue,
        });

        return reply.send({
          success: true,
          message: "Subscription billing cycle completed",
          data: {
            trialRemindersSent: reminders.sent,
            trialReminderNotificationsSent: reminders.notificationsSent,
            trialRemindersSkipped: reminders.skipped,
            trialRemindersFailed: reminders.failed,
            expiredTrials: result.expiredTrials,
            pastDue: result.pastDue,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to run subscription billing cycle",
        });
      }
    },
  );
}

module.exports = processBillingRoutes;
