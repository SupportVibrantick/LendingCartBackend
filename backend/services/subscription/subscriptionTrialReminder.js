const { enqueueEmail } = require("../email");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { commonLogs } = require("../logger/contextLogger");
const { getPackagePrice } = require("../subscription/subscriptionBilling");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../notifications/brokerNotifications");

const MS_23H = 23 * 60 * 60 * 1000;
const MS_25H = 25 * 60 * 60 * 1000;

function formatTrialEndDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

function formatCurrency(amount, billingCycle) {
  const formatted = Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `${formatted}/${billingCycle === "YEARLY" ? "year" : "month"}`;
}

async function resolveBrokerRecipient(prisma, organizationId) {
  const admin = await prisma.userAccount.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      roles: {
        some: {
          role: { name: "BROKER_ADMIN" },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  if (admin?.email) {
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
    return { userId: admin.id, email: admin.email, name: name || "there" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { email: true, name: true },
  });

  if (org?.email) {
    return { userId: null, email: org.email, name: org.name || "there" };
  }

  return null;
}

async function sendTrialEndingReminderEmail(prisma, subscription, recipient) {
  const loginUrl = buildBrokerSignInUrl();
  const planPrice = getPackagePrice(subscription.package, subscription.billingCycle);
  const trialEndsAtFormatted = formatTrialEndDate(subscription.trialEndsAt);

  const html = loadTemplate("subscription/trialEndingReminder", {
    name: recipient.name,
    organizationName: subscription.organization.name,
    planName: subscription.package.name,
    planPrice: formatCurrency(planPrice, subscription.billingCycle),
    billingCycle: subscription.billingCycle === "YEARLY" ? "yearly" : "monthly",
    trialEndsAt: trialEndsAtFormatted,
    loginUrl,
  });

  const subject = `Your LendingCart trial ends tomorrow — ${subscription.package.name} plan`;
  const text = `Hi ${recipient.name}, your free trial for the ${subscription.package.name} plan ends on ${trialEndsAtFormatted}. After that, billing will begin at ${formatCurrency(planPrice, subscription.billingCycle)}. Log in at ${loginUrl}`;

  await enqueueEmail({
    prisma,
    to: recipient.email,
    subject,
    text,
    html,
    idempotencyKey: `trial-ending:${subscription.id}:${subscription.trialEndsAt?.toISOString?.() || "unknown"}`,
    provider: "SMTP",
  });
}

async function sendTrialEndingReminderNotification(prisma, io, subscription, recipient) {
  const planPrice = getPackagePrice(subscription.package, subscription.billingCycle);
  const trialEndsAtFormatted = formatTrialEndDate(subscription.trialEndsAt);
  const planName = subscription.package.name;
  const subject = `Your trial ends tomorrow — ${planName} plan`;
  const body = `Your free trial for the ${planName} plan ends on ${trialEndsAtFormatted}. After that, billing will begin at ${formatCurrency(planPrice, subscription.billingCycle)}.`;

  await notifyBroker(prisma, io, {
    brokerOrgId: subscription.organizationId,
    eventType: BROKER_NOTIFICATION_EVENTS.TRIAL_ENDING_SOON,
    category: "SUBSCRIPTION",
    subject,
    body,
    metadata: {
      subscriptionId: subscription.id,
      planName,
      planPrice: formatCurrency(planPrice, subscription.billingCycle),
      billingCycle: subscription.billingCycle,
      trialEndsAt: subscription.trialEndsAt,
    },
    recipientUserId: recipient.userId || null,
  });
}

/**
 * Send reminder emails and in-app notifications ~24 hours before trialEndsAt (23–25h window).
 */
async function sendTrialEndingReminders(prisma, io = null) {
  const now = Date.now();
  const windowStart = new Date(now + MS_23H);
  const windowEnd = new Date(now + MS_25H);

  const trials = await prisma.organizationSubscription.findMany({
    where: {
      status: "TRIAL",
      trialEndingReminderSentAt: null,
      trialEndsAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      package: true,
      organization: { select: { id: true, name: true, email: true } },
    },
  });

  const results = { sent: 0, skipped: 0, failed: 0, notificationsSent: 0 };

  for (const subscription of trials) {
    const recipient = await resolveBrokerRecipient(prisma, subscription.organizationId);

    if (!recipient?.email) {
      commonLogs.warn("Trial ending reminder skipped — no broker email", {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
      });
      results.skipped += 1;
      continue;
    }

    try {
      await sendTrialEndingReminderEmail(prisma, subscription, recipient);

      try {
        await sendTrialEndingReminderNotification(prisma, io, subscription, recipient);
        results.notificationsSent += 1;
      } catch (notifErr) {
        commonLogs.warn("Trial ending dashboard notification failed", {
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          error: notifErr.message,
        });
      }

      await prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: { trialEndingReminderSentAt: new Date() },
      });

      commonLogs.info("Trial ending reminder sent", {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        to: recipient.email,
        trialEndsAt: subscription.trialEndsAt,
      });

      results.sent += 1;
    } catch (error) {
      commonLogs.error("Trial ending reminder failed", {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        to: recipient.email,
        error: error.message,
      });
      results.failed += 1;
    }
  }

  return results;
}

module.exports = {
  sendTrialEndingReminders,
  formatTrialEndDate,
};
