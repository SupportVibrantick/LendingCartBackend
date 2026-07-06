const campaignScheduler = require("./campaign.scheduler");
const subscriptionScheduler = require("./subscription.scheduler");
const documentReminderScheduler = require("./documentReminder.scheduler");
const { schedulerLogs } = require("../services/logger/contextLogger");

function startSchedulers(app) {
  campaignScheduler(app);
  subscriptionScheduler(app);
  documentReminderScheduler(app);

  schedulerLogs.info("All schedulers registered", {
    jobs: [
      "campaign-recurring",
      "subscription-billing",
      "document-reminders",
    ],
  });

  app.log.info("Campaign scheduler started");
  app.log.info("Subscription billing scheduler started");
  app.log.info("Document reminder scheduler started");
}

module.exports = startSchedulers;
