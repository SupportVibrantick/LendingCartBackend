const campaignScheduler = require("./campaign.scheduler");
const subscriptionScheduler = require("./subscription.scheduler");
const documentReminderScheduler = require("./documentReminder.scheduler");
const auditLogScheduler = require("./auditLog.scheduler");
const { schedulerLogs } = require("../services/logger/contextLogger");

function startSchedulers(app) {
  campaignScheduler(app);
  subscriptionScheduler(app);
  documentReminderScheduler(app);
  auditLogScheduler(app);

  schedulerLogs.info("All schedulers registered", {
    jobs: [
      "campaign-recurring",
      "subscription-billing",
      "document-reminders",
      "audit-log-maintenance",
    ],
  });

  app.log.info("Campaign scheduler started");
  app.log.info("Subscription billing scheduler started");
  app.log.info("Document reminder scheduler started");
  app.log.info("AuditLog maintenance scheduler started");
}

module.exports = startSchedulers;
