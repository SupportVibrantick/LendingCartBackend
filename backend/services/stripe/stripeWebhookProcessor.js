/**
 * Stripe webhook handlers — keep LendingCart org subscriptions in sync
 * when billing is cancelled/ended on Stripe (GHL Payments → Stripe).
 */

const { commonLogs } = require("../logger/contextLogger");
const {
  CLM_GHL_SOFT_TRIAL_NOTE,
  CLM_GHL_DISCONTINUED_NOTE,
  appendSubscriptionNote,
  isClmGhlSoftTrial,
} = require("../subscription/freeTrial");
const {
  cancelSubscription,
} = require("../subscription/subscriptionBilling");

async function findOrgSubByStripeIds(prisma, { stripeSubscriptionId, stripeCustomerId }) {
  if (stripeSubscriptionId) {
    const byStripe = await prisma.organizationSubscription.findFirst({
      where: { stripeSubscriptionId },
      orderBy: { createdAt: "desc" },
    });
    if (byStripe) return byStripe;

    // Legacy: Stripe sub id sometimes stored in ghlSubscriptionId
    const byGhl = await prisma.organizationSubscription.findFirst({
      where: { ghlSubscriptionId: stripeSubscriptionId },
      orderBy: { createdAt: "desc" },
    });
    if (byGhl) return byGhl;
  }

  if (stripeCustomerId) {
    return prisma.organizationSubscription.findFirst({
      where: {
        stripeCustomerId,
        notes: { contains: CLM_GHL_SOFT_TRIAL_NOTE },
        status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return null;
}

/**
 * customer.subscription.deleted / canceled → lock LC access for CLM brokers.
 */
async function handleStripeSubscriptionDeleted(prisma, stripeSubscription) {
  const stripeSubscriptionId = stripeSubscription?.id || null;
  const stripeCustomerId =
    typeof stripeSubscription?.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription?.customer?.id || null;

  const sub = await findOrgSubByStripeIds(prisma, {
    stripeSubscriptionId,
    stripeCustomerId,
  });

  if (!sub) {
    commonLogs.info("Stripe subscription deleted — no LC org sub matched", {
      event: "stripe.subscription.deleted.unmatched",
      stripeSubscriptionId,
      stripeCustomerId,
    });
    return {
      action: "stripe_subscription_deleted",
      found: false,
      stripeSubscriptionId,
    };
  }

  // Persist Stripe ids if we matched via ghlSubscriptionId
  if (
    stripeSubscriptionId &&
    sub.stripeSubscriptionId !== stripeSubscriptionId
  ) {
    await prisma.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        stripeSubscriptionId,
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      },
    });
  }

  if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
    return {
      action: "stripe_subscription_deleted",
      found: true,
      skipped: true,
      reason: `already ${sub.status}`,
      organizationSubscriptionId: sub.id,
    };
  }

  // Only auto-lock CLM soft-trial funnels from Stripe deletes
  // (avoid cancelling unrelated LC-managed plans if ids collide).
  if (!isClmGhlSoftTrial(sub)) {
    return {
      action: "stripe_subscription_deleted",
      found: true,
      skipped: true,
      reason: "not_clm_soft_trial",
      organizationSubscriptionId: sub.id,
    };
  }

  const cancelled = await cancelSubscription(prisma, {
    organizationId: sub.organizationId,
    immediate: true,
  });

  await prisma.organizationSubscription.update({
    where: { id: cancelled.id },
    data: {
      stripeSubscriptionId: stripeSubscriptionId || cancelled.stripeSubscriptionId,
      stripeCustomerId: stripeCustomerId || cancelled.stripeCustomerId,
      notes: appendSubscriptionNote(
        appendSubscriptionNote(cancelled.notes, CLM_GHL_DISCONTINUED_NOTE),
        "source:STRIPE_WEBHOOK_DELETED",
      ),
    },
  });

  commonLogs.info("CLM org subscription cancelled from Stripe webhook", {
    event: "stripe.clm.subscription.cancelled",
    organizationSubscriptionId: cancelled.id,
    organizationId: cancelled.organizationId,
    stripeSubscriptionId,
  });

  return {
    action: "stripe_subscription_deleted",
    found: true,
    organizationSubscriptionId: cancelled.id,
    status: cancelled.status,
    stripeSubscriptionId,
  };
}

/**
 * Persist Stripe ids onto a CLM org subscription when we learn them.
 */
async function attachStripeIdsToClmSubscription(
  prisma,
  organizationSubscriptionId,
  { stripeSubscriptionId, stripeCustomerId } = {},
) {
  if (!organizationSubscriptionId) return null;
  const data = {};
  if (stripeSubscriptionId) data.stripeSubscriptionId = stripeSubscriptionId;
  if (stripeCustomerId) data.stripeCustomerId = stripeCustomerId;
  if (!Object.keys(data).length) return null;

  return prisma.organizationSubscription.update({
    where: { id: organizationSubscriptionId },
    data,
  });
}

async function processStripeWebhookEvent(prisma, event) {
  const type = event?.type || "";
  const object = event?.data?.object || {};

  if (
    type === "customer.subscription.deleted" ||
    (type === "customer.subscription.updated" &&
      (object.status === "canceled" || object.cancel_at_period_end === true))
  ) {
    // Only hard-cancel access on deleted (or already canceled status).
    if (
      type === "customer.subscription.updated" &&
      object.status !== "canceled" &&
      object.cancel_at_period_end
    ) {
      // User scheduled cancel at period end — keep access until deleted.
      return {
        action: "stripe_cancel_at_period_end_noted",
        stripeSubscriptionId: object.id,
        status: object.status,
      };
    }
    return handleStripeSubscriptionDeleted(prisma, object);
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "invoice.paid"
  ) {
    // Best-effort: if we can match by customer/email later we attach ids in sync path.
    return {
      action: "stripe_event_ignored",
      type,
      stripeSubscriptionId: object.id || object.subscription || null,
    };
  }

  return { action: "stripe_event_ignored", type };
}

module.exports = {
  findOrgSubByStripeIds,
  handleStripeSubscriptionDeleted,
  attachStripeIdsToClmSubscription,
  processStripeWebhookEvent,
};
