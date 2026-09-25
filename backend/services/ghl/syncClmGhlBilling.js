/**
 * Keep CLM org subscriptions in sync when GHL charges $699 after the free trial
 * (or sends subscription lifecycle events without a Loan AI checkout row).
 */

const {
  isClmGhlSoftTrial,
  CLM_GHL_SOFT_TRIAL_NOTE,
  CLM_GHL_BILLING_PHASE_NOTE,
  appendSubscriptionNote,
} = require("../subscription/freeTrial");
const { addPeriod } = require("../subscription/subscriptionBilling");
const { commonLogs } = require("../logger/contextLogger");

async function findClmOrganizationSubscription(prisma, ids = {}) {
  if (ids.ghlSubscriptionId) {
    const bySub = await prisma.organizationSubscription.findFirst({
      where: { ghlSubscriptionId: ids.ghlSubscriptionId },
      orderBy: { createdAt: "desc" },
      include: { package: true },
    });
    if (bySub && isClmGhlSoftTrial(bySub)) return bySub;
  }

  if (ids.ghlContactId) {
    const byContact = await prisma.organizationSubscription.findFirst({
      where: {
        ghlContactId: ids.ghlContactId,
        notes: { contains: CLM_GHL_SOFT_TRIAL_NOTE },
      },
      orderBy: { createdAt: "desc" },
      include: { package: true },
    });
    if (byContact) return byContact;
  }

  if (ids.email) {
    const user = await prisma.loanAiUser.findFirst({
      where: { email: { equals: ids.email, mode: "insensitive" } },
      select: { id: true, brokerOrganizationId: true },
    });
    if (user?.brokerOrganizationId) {
      return prisma.organizationSubscription.findFirst({
        where: {
          organizationId: user.brokerOrganizationId,
          notes: { contains: CLM_GHL_SOFT_TRIAL_NOTE },
          status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
        },
        orderBy: { createdAt: "desc" },
        include: { package: true },
      });
    }
  }

  return null;
}

/**
 * On GHL payment / subscription.charged for a CLM broker:
 * ensure ACTIVE (no LC invoice), refresh period, store ghlSubscriptionId.
 */
async function syncClmSubscriptionFromGhlPayment(prisma, ids = {}) {
  const sub = await findClmOrganizationSubscription(prisma, ids);
  if (!sub) return null;

  if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
    return {
      action: "clm_billing_sync_skipped",
      reason: `subscription already ${sub.status}`,
      organizationSubscriptionId: sub.id,
    };
  }

  const now = new Date();
  const periodEnd = addPeriod(now, sub.billingCycle || "MONTHLY");

  const updated = await prisma.organizationSubscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      notes: appendSubscriptionNote(sub.notes, CLM_GHL_BILLING_PHASE_NOTE),
      ...(ids.ghlContactId ? { ghlContactId: ids.ghlContactId } : {}),
      ...(ids.ghlInvoiceId ? { ghlInvoiceId: ids.ghlInvoiceId } : {}),
      ...(ids.ghlSubscriptionId
        ? { ghlSubscriptionId: ids.ghlSubscriptionId }
        : {}),
      ...(ids.ghlPriceId ? { ghlPriceId: ids.ghlPriceId } : {}),
      ...(ids.ghlProductId ? { ghlProductId: ids.ghlProductId } : {}),
      ...(ids.stripeSubscriptionId
        ? { stripeSubscriptionId: ids.stripeSubscriptionId }
        : {}),
      ...(ids.stripeCustomerId
        ? { stripeCustomerId: ids.stripeCustomerId }
        : {}),
    },
  });

  // If Stripe id still missing, try email lookup (same Stripe account as GHL Payments).
  if (!updated.stripeSubscriptionId && ids.email) {
    try {
      const {
        isStripeConfigured,
        resolveStripeSubscriptionForClm,
      } = require("../stripe/stripeBilling");
      if (isStripeConfigured()) {
        const resolved = await resolveStripeSubscriptionForClm(updated, {
          email: ids.email,
        });
        if (resolved.stripeSubscriptionId) {
          await prisma.organizationSubscription.update({
            where: { id: updated.id },
            data: {
              stripeSubscriptionId: resolved.stripeSubscriptionId,
              ...(resolved.stripeCustomerId
                ? { stripeCustomerId: resolved.stripeCustomerId }
                : {}),
            },
          });
          updated.stripeSubscriptionId = resolved.stripeSubscriptionId;
        }
      }
    } catch (err) {
      commonLogs.warn("CLM billing sync — Stripe resolve skipped", {
        error: err?.message,
        organizationSubscriptionId: updated.id,
      });
    }
  }

  commonLogs.info("CLM GHL billing synced after payment", {
    event: "ghl.clm_billing.synced",
    organizationSubscriptionId: updated.id,
    organizationId: updated.organizationId,
    ghlSubscriptionId: updated.ghlSubscriptionId,
    stripeSubscriptionId: updated.stripeSubscriptionId || null,
  });

  return {
    action: "clm_billing_synced",
    organizationSubscriptionId: updated.id,
    organizationId: updated.organizationId,
    status: updated.status,
  };
}

module.exports = {
  findClmOrganizationSubscription,
  syncClmSubscriptionFromGhlPayment,
};
