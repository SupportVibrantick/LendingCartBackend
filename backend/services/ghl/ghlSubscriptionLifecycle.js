const { cancelSubscription, BROKER_ACCESS_STATUSES } = require("../subscription/subscriptionBilling");
const {
  fulfillPaidGhlCheckout,
  markCheckoutPaymentFailed,
} = require("./fulfillGhlCheckout");
const {
  logPaymentStatusChanged,
  logSubscriptionStatusChanged,
} = require("./ghlPaymentLogger");

/**
 * Existing project access policy (verifyBrokerSubscription / assertBrokerSubscriptionAccess):
 * - Allowed: TRIAL, ACTIVE
 * - Blocked: PAST_DUE, CANCELLED, EXPIRED
 *
 * This module only applies those statuses — it does not invent new rules.
 */

async function findOrganizationSubscription(prisma, { checkout, ids = {} } = {}) {
  if (checkout?.organizationSubscriptionId) {
    const linked = await prisma.organizationSubscription.findUnique({
      where: { id: checkout.organizationSubscriptionId },
    });
    if (linked) return linked;
  }

  if (ids.ghlSubscriptionId) {
    const byGhlSub = await prisma.organizationSubscription.findFirst({
      where: { ghlSubscriptionId: ids.ghlSubscriptionId },
      orderBy: { createdAt: "desc" },
    });
    if (byGhlSub) return byGhlSub;
  }

  if (ids.ghlContactId) {
    const byContact = await prisma.organizationSubscription.findFirst({
      where: { ghlContactId: ids.ghlContactId },
      orderBy: { createdAt: "desc" },
    });
    if (byContact) return byContact;
  }

  if (checkout?.loanAiUserId) {
    const user = await prisma.loanAiUser.findUnique({
      where: { id: checkout.loanAiUserId },
    });
    if (user?.brokerOrganizationId) {
      return prisma.organizationSubscription.findFirst({
        where: {
          organizationId: user.brokerOrganizationId,
          status: {
            in: [...BROKER_ACCESS_STATUSES, "PAST_DUE", "PENDING", "FAILED"],
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  return null;
}

/**
 * Payment successful → activate package / permissions (ACTIVE).
 */
async function handleGhlPaymentSuccess(prisma, io, checkout, paymentMeta = {}) {
  const result = await fulfillPaidGhlCheckout(prisma, io, checkout, paymentMeta);
  logPaymentStatusChanged({
    checkoutId: result.checkoutId,
    loanAiUserId: result.loanAiUserId || checkout?.loanAiUserId,
    packageId: checkout?.packageId,
    billingPeriod: checkout?.billingCycle,
    ghlContactId: paymentMeta.ghlContactId || checkout?.ghlContactId,
    ghlPriceId: paymentMeta.ghlPriceId || checkout?.ghlPriceId,
    ghlInvoiceId: paymentMeta.ghlInvoiceId || checkout?.ghlInvoiceId,
    ghlSubscriptionId:
      paymentMeta.ghlSubscriptionId || checkout?.ghlSubscriptionId,
    organizationSubscriptionId: result.organizationSubscriptionId,
    previousStatus: checkout?.paymentStatus || "PENDING",
    paymentStatus: "PAID",
    status: "PAID",
    reason: result.alreadyProcessed ? "already_processed" : "payment_success",
  });
  logSubscriptionStatusChanged({
    checkoutId: result.checkoutId,
    loanAiUserId: result.loanAiUserId || checkout?.loanAiUserId,
    packageId: checkout?.packageId,
    billingPeriod: checkout?.billingCycle,
    organizationSubscriptionId: result.organizationSubscriptionId,
    subscriptionStatus: "ACTIVE",
    ghlContactId: paymentMeta.ghlContactId || checkout?.ghlContactId,
    ghlSubscriptionId:
      paymentMeta.ghlSubscriptionId || checkout?.ghlSubscriptionId,
    reason: "payment_success",
  });
  return { action: "payment_success", ...result };
}

/**
 * Payment failed → do not grant broker access.
 * Checkout stays FAILED; any PENDING org subscription is marked FAILED.
 */
async function handleGhlPaymentFailure(prisma, checkout, reason) {
  const updatedCheckout = await markCheckoutPaymentFailed(
    prisma,
    checkout,
    reason || "GHL payment failed",
  );

  let organizationSubscriptionId = null;
  if (checkout?.organizationSubscriptionId) {
    const sub = await prisma.organizationSubscription.findUnique({
      where: { id: checkout.organizationSubscriptionId },
    });
    if (sub && (sub.status === "PENDING" || sub.status === "FAILED")) {
      await prisma.organizationSubscription.update({
        where: { id: sub.id },
        data: { status: "FAILED" },
      });
      organizationSubscriptionId = sub.id;
    }
  }

  logPaymentStatusChanged({
    checkoutId: checkout?.id,
    loanAiUserId: checkout?.loanAiUserId,
    packageId: checkout?.packageId,
    billingPeriod: checkout?.billingCycle,
    ghlContactId: checkout?.ghlContactId,
    ghlPriceId: checkout?.ghlPriceId,
    organizationSubscriptionId,
    previousStatus: checkout?.paymentStatus || "PENDING",
    paymentStatus: "FAILED",
    status: "FAILED",
    reason: reason || "payment_failed",
  });

  return {
    action: "payment_failed",
    checkoutId: updatedCheckout?.id || checkout?.id,
    organizationSubscriptionId,
  };
}

/**
 * Subscription cancelled → existing cancelSubscription(immediate) policy.
 * Immediate cancel sets CANCELLED + cancelledAt (blocks broker access).
 */
async function handleGhlSubscriptionCancelled(prisma, { checkout, ids = {} } = {}) {
  const sub = await findOrganizationSubscription(prisma, { checkout, ids });
  if (!sub) {
    if (checkout?.id) {
      await prisma.loanAiGhlCheckout.update({
        where: { id: checkout.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: new Date(),
          lastError: "GHL subscription cancelled (no org subscription found)",
        },
      });
    }
    return {
      action: "subscription_cancelled",
      found: false,
      checkoutId: checkout?.id || null,
    };
  }

  // Reuse existing cancellation policy: immediate revoke
  const cancelled = await cancelSubscription(prisma, {
    organizationId: sub.organizationId,
    immediate: true,
  });

  if (checkout?.id) {
    await prisma.loanAiGhlCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
        cancelledAt: new Date(),
        organizationSubscriptionId: cancelled.id,
        ghlSubscriptionId: ids.ghlSubscriptionId || checkout.ghlSubscriptionId,
        lastError: null,
      },
    });
  } else {
    await prisma.organizationSubscription.update({
      where: { id: cancelled.id },
      data: {
        ghlSubscriptionId: ids.ghlSubscriptionId || cancelled.ghlSubscriptionId,
        ghlContactId: ids.ghlContactId || cancelled.ghlContactId,
      },
    });
  }

  logSubscriptionStatusChanged({
    checkoutId: checkout?.id || null,
    loanAiUserId: checkout?.loanAiUserId || null,
    packageId: checkout?.packageId || null,
    billingPeriod: checkout?.billingCycle || null,
    organizationSubscriptionId: cancelled.id,
    previousStatus: sub.status,
    subscriptionStatus: "CANCELLED",
    ghlContactId: ids.ghlContactId || cancelled.ghlContactId,
    ghlSubscriptionId: ids.ghlSubscriptionId || cancelled.ghlSubscriptionId,
    paymentStatus: "CANCELLED",
    reason: "subscription_cancelled",
  });

  return {
    action: "subscription_cancelled",
    found: true,
    organizationSubscriptionId: cancelled.id,
    checkoutId: checkout?.id || null,
  };
}

/**
 * Past due → same status used by markPastDueSubscriptions.
 * Broker access is blocked by assertBrokerSubscriptionAccess for PAST_DUE.
 */
async function handleGhlSubscriptionPastDue(prisma, { checkout, ids = {} } = {}) {
  const sub = await findOrganizationSubscription(prisma, { checkout, ids });
  if (!sub) {
    return {
      action: "subscription_past_due",
      found: false,
      checkoutId: checkout?.id || null,
    };
  }

  // Do not overwrite CANCELLED/EXPIRED with PAST_DUE
  if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
    return {
      action: "subscription_past_due",
      found: true,
      skipped: true,
      reason: `subscription already ${sub.status}`,
      organizationSubscriptionId: sub.id,
    };
  }

  const updated = await prisma.organizationSubscription.update({
    where: { id: sub.id },
    data: {
      status: "PAST_DUE",
      ghlSubscriptionId: ids.ghlSubscriptionId || sub.ghlSubscriptionId,
      ghlContactId: ids.ghlContactId || sub.ghlContactId,
      ghlInvoiceId: ids.ghlInvoiceId || sub.ghlInvoiceId,
    },
  });

  // Mirror on related pending invoice if present (existing billing uses PENDING invoices)
  await prisma.subscriptionInvoice.updateMany({
    where: {
      organizationSubscriptionId: updated.id,
      status: "PENDING",
    },
    data: {
      ghlInvoiceId: ids.ghlInvoiceId || undefined,
      ghlSubscriptionId: ids.ghlSubscriptionId || undefined,
    },
  });

  if (checkout?.id) {
    await prisma.loanAiGhlCheckout.update({
      where: { id: checkout.id },
      data: {
        organizationSubscriptionId: updated.id,
        ghlSubscriptionId: ids.ghlSubscriptionId || checkout.ghlSubscriptionId,
        lastError: "GHL reported subscription past due",
      },
    });
  }

  logSubscriptionStatusChanged({
    checkoutId: checkout?.id || null,
    loanAiUserId: checkout?.loanAiUserId || null,
    packageId: checkout?.packageId || null,
    billingPeriod: checkout?.billingCycle || null,
    organizationSubscriptionId: updated.id,
    previousStatus: sub.status,
    subscriptionStatus: "PAST_DUE",
    ghlContactId: ids.ghlContactId || updated.ghlContactId,
    ghlSubscriptionId: ids.ghlSubscriptionId || updated.ghlSubscriptionId,
    reason: "subscription_past_due",
  });

  return {
    action: "subscription_past_due",
    found: true,
    organizationSubscriptionId: updated.id,
    checkoutId: checkout?.id || null,
  };
}

/**
 * Subscription expired → EXPIRED status (blocks broker access; user may renew).
 */
async function handleGhlSubscriptionExpired(prisma, { checkout, ids = {} } = {}) {
  const sub = await findOrganizationSubscription(prisma, { checkout, ids });
  if (!sub) {
    if (checkout?.id) {
      await prisma.loanAiGhlCheckout.update({
        where: { id: checkout.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: new Date(),
          lastError: "GHL subscription expired (no org subscription found)",
        },
      });
    }
    return {
      action: "subscription_expired",
      found: false,
      checkoutId: checkout?.id || null,
    };
  }

  if (sub.status === "EXPIRED") {
    return {
      action: "subscription_expired",
      found: true,
      skipped: true,
      organizationSubscriptionId: sub.id,
      checkoutId: checkout?.id || null,
    };
  }

  const updated = await prisma.organizationSubscription.update({
    where: { id: sub.id },
    data: {
      status: "EXPIRED",
      ghlSubscriptionId: ids.ghlSubscriptionId || sub.ghlSubscriptionId,
      ghlContactId: ids.ghlContactId || sub.ghlContactId,
    },
  });

  if (checkout?.id) {
    await prisma.loanAiGhlCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
        cancelledAt: new Date(),
        organizationSubscriptionId: updated.id,
        ghlSubscriptionId: ids.ghlSubscriptionId || checkout.ghlSubscriptionId,
        lastError: "GHL subscription expired",
      },
    });
  }

  logSubscriptionStatusChanged({
    checkoutId: checkout?.id || null,
    loanAiUserId: checkout?.loanAiUserId || null,
    packageId: checkout?.packageId || null,
    billingPeriod: checkout?.billingCycle || null,
    organizationSubscriptionId: updated.id,
    previousStatus: sub.status,
    subscriptionStatus: "EXPIRED",
    ghlContactId: ids.ghlContactId || updated.ghlContactId,
    ghlSubscriptionId: ids.ghlSubscriptionId || updated.ghlSubscriptionId,
    paymentStatus: checkout?.id ? "CANCELLED" : undefined,
    reason: "subscription_expired",
  });

  return {
    action: "subscription_expired",
    found: true,
    organizationSubscriptionId: updated.id,
    checkoutId: checkout?.id || null,
  };
}

module.exports = {
  findOrganizationSubscription,
  handleGhlPaymentSuccess,
  handleGhlPaymentFailure,
  handleGhlSubscriptionCancelled,
  handleGhlSubscriptionPastDue,
  handleGhlSubscriptionExpired,
};
