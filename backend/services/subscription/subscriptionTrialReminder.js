const { enqueueEmail } = require("../email");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildBrokerSignInUrl } = require("../../utils/email/emailBranding");
const { commonLogs } = require("../logger/contextLogger");
const { getPackagePrice } = require("../subscription/subscriptionBilling");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../notifications/brokerNotifications");
const { isClmGhlSoftTrial } = require("./freeTrial");

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
  const isClm = isClmGhlSoftTrial(subscription);

  const afterTrialNote = isClm
    ? "When your free period ends, the card on your Commercial Lending Mastery order will be charged automatically. Your Loan Automation account will stay open — use Discontinue in the dashboard if you want to stop billing."
    : "When your trial ends, your subscription will become active and your first invoice will be generated. Please ensure your billing details are up to date to avoid any interruption to your broker dashboard access.";

  const html = loadTemplate("subscription/trialEndingReminder", {
    name: recipient.name,
    organizationName: subscription.organization.name,
    planName: subscription.package.name,
    planPrice: formatCurrency(planPrice, subscription.billingCycle),
    billingCycle: subscription.billingCycle === "YEARLY" ? "yearly" : "monthly",
    trialEndsAt: trialEndsAtFormatted,
    loginUrl,
    afterTrialNote,
  });

  const subject = isClm
    ? `Your free Loan Automation access ends tomorrow — ${subscription.package.name}`
    : `Your LendingCart trial ends tomorrow — ${subscription.package.name} plan`;
  const text = isClm
    ? `Hi ${recipient.name}, your free Loan Automation access for ${subscription.package.name} ends on ${trialEndsAtFormatted}. After that, ${formatCurrency(planPrice, subscription.billingCycle)} will be charged to the card on your CLM order unless you Discontinue in the dashboard. Log in at ${loginUrl}`
    : `Hi ${recipient.name}, your free trial for the ${subscription.package.name} plan ends on ${trialEndsAtFormatted}. After that, billing will begin at ${formatCurrency(planPrice, subscription.billingCycle)}. Log in at ${loginUrl}`;

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
  const isClm = isClmGhlSoftTrial(subscription);
  const subject = `Your trial ends tomorrow — ${planName} plan`;
  const body = isClm
    ? `Your free Loan Automation access ends on ${trialEndsAtFormatted}. After that, billing starts at ${formatCurrency(planPrice, subscription.billingCycle)} on the card from your CLM order. Use Discontinue in the dashboard if you want to stop.`
    : `Your free trial for the ${planName} plan ends on ${trialEndsAtFormatted}. After that, billing will begin at ${formatCurrency(planPrice, subscription.billingCycle)}.`;

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
      isClmSoftTrial: isClm,
    },
    recipientUserId: recipient.userId || null,
  });
}

/**
 * Alert when CLM free period ends — account stays open; Discontinue is available.
 */
async function sendClmTrialCompletedAlert(prisma, io, subscription) {
  if (!subscription || !isClmGhlSoftTrial(subscription)) return null;

  const recipient = await resolveBrokerRecipient(
    prisma,
    subscription.organizationId,
  );
  if (!recipient?.email) {
    commonLogs.warn("CLM trial-completed alert skipped — no broker email", {
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
    });
    return null;
  }

  const loginUrl = buildBrokerSignInUrl();
  const planPrice = getPackagePrice(
    subscription.package,
    subscription.billingCycle,
  );
  const planName = subscription.package?.name || "Elite";
  const priceLabel = formatCurrency(planPrice, subscription.billingCycle);

  const html = loadTemplate("subscription/clmTrialCompleted", {
    name: recipient.name,
    organizationName: subscription.organization?.name || "your organization",
    planName,
    planPrice: priceLabel,
    loginUrl,
  });

  const subject = "Your free Loan Automation trial is complete";
  const text = `Hi ${recipient.name}, your free Loan Automation trial is complete. Your account stays open and ${priceLabel} will be charged to the card on your Commercial Lending Mastery order. If you want to stop, open the dashboard and click Discontinue. Log in: ${loginUrl}`;

  await enqueueEmail({
    prisma,
    to: recipient.email,
    subject,
    text,
    html,
    idempotencyKey: `clm-trial-completed:${subscription.id}`,
    provider: "SMTP",
  });

  try {
    await notifyBroker(prisma, io, {
      brokerOrgId: subscription.organizationId,
      eventType: BROKER_NOTIFICATION_EVENTS.TRIAL_COMPLETED,
      category: "SUBSCRIPTION",
      subject,
      body: `Your free trial is complete. Billing continues at ${priceLabel} unless you Discontinue in the dashboard.`,
      metadata: {
        subscriptionId: subscription.id,
        planName,
        planPrice: priceLabel,
        billingCycle: subscription.billingCycle,
        trialEndsAt: subscription.trialEndsAt,
        canDiscontinue: true,
      },
      recipientUserId: recipient.userId || null,
    });
  } catch (notifErr) {
    commonLogs.warn("CLM trial-completed dashboard notification failed", {
      subscriptionId: subscription.id,
      error: notifErr.message,
    });
  }

  commonLogs.info("CLM trial-completed alert sent", {
    subscriptionId: subscription.id,
    organizationId: subscription.organizationId,
    to: recipient.email,
  });

  return { sent: true, email: recipient.email };
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
  sendClmTrialCompletedAlert,
  formatTrialEndDate,
};
