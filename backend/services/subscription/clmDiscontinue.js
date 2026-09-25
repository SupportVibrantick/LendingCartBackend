/**
 * Voluntary discontinue for CLM GHL soft-trial brokers.
 *
 * - Cancels LendingCart access immediately (CANCELLED → lock until they subscribe)
 * - Stops billing via Stripe API (same Stripe account as GHL Payments)
 * - Best-effort GHL tag / webhook / GHL subscription cancel as fallbacks
 */

const {
  cancelSubscription,
  getPackagePrice,
} = require("./subscriptionBilling");
const {
  isClmGhlSoftTrial,
  canShowClmDiscontinue,
  CLM_GHL_DISCONTINUED_NOTE,
  appendSubscriptionNote,
} = require("./freeTrial");
const { commonLogs } = require("../logger/contextLogger");
const {
  cancelGhlSubscription,
  getDiscontinueTag,
} = require("../ghl/ghl.payment.service");
const {
  isStripeConfigured,
  resolveStripeSubscriptionForClm,
  cancelStripeSubscription,
} = require("../stripe/stripeBilling");
const ghlService = require("../../modules/ghl/ghl.service");
const { createGhlApiClient } = require("../../modules/ghl/ghl.client");
const { enqueueEmail } = require("../email");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildBrokerSignInUrl,
  buildLoanAiPricingUrl,
} = require("../../utils/email/emailBranding");

function getDiscontinueWebhookUrl() {
  return String(process.env.CLM_GHL_DISCONTINUE_WEBHOOK_URL || "").trim();
}

async function tagGhlContactForDiscontinue(ghlContactId) {
  const tag = getDiscontinueTag();
  if (!ghlContactId || !tag) {
    return { tagged: false, reason: "missing_contact_or_tag" };
  }

  try {
    const client = createGhlApiClient();
    await ghlService.addTagsToContact(client, ghlContactId, [tag]);
    return { tagged: true, tag };
  } catch (err) {
    commonLogs.warn("CLM discontinue — GHL tag failed", {
      ghlContactId,
      tag,
      error: err?.message,
    });
    return { tagged: false, reason: err?.message || "tag_failed", tag };
  }
}

async function fireDiscontinueWebhook(payload) {
  const url = getDiscontinueWebhookUrl();
  if (!url) return { fired: false, reason: "not_configured" };

  try {
    const axios = require("axios");
    await axios.post(url, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
    return { fired: true };
  } catch (err) {
    commonLogs.warn("CLM discontinue webhook failed", {
      error: err?.message,
    });
    return { fired: false, reason: err?.message || "webhook_failed" };
  }
}

async function resolveBrokerAdmin(prisma, organizationId) {
  return prisma.userAccount.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      roles: { some: { role: { name: "BROKER_ADMIN" } } },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });
}

async function resolveBrokerEmail(prisma, organizationId, sub) {
  const admin = await resolveBrokerAdmin(prisma, organizationId);
  if (admin?.email) return admin.email;
  if (sub.organization?.email) return sub.organization.email;
  if (sub.loanAiUserId) {
    const user = await prisma.loanAiUser.findUnique({
      where: { id: sub.loanAiUserId },
      select: { email: true },
    });
    if (user?.email) return user.email;
  }
  return null;
}

/**
 * @returns {Promise<object>} subscription status payload for broker UI
 */
async function getClmSubscriptionStatus(prisma, organizationId) {
  const sub = await prisma.organizationSubscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      package: {
        select: {
          id: true,
          code: true,
          name: true,
          priceMonthly: true,
          priceYearly: true,
        },
      },
    },
  });

  if (!sub) {
    return {
      hasSubscription: false,
      isClmSoftTrial: false,
      canDiscontinue: false,
      showTrialCompletedAlert: false,
    };
  }

  const isClm = isClmGhlSoftTrial(sub);
  const canDiscontinue = canShowClmDiscontinue(sub);
  const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const trialEnded =
    Boolean(trialEndsAt) && trialEndsAt.getTime() <= Date.now();

  const planPrice = getPackagePrice(sub.package, sub.billingCycle);
  const subscribeUrl = buildLoanAiPricingUrl();

  return {
    hasSubscription: true,
    subscriptionId: sub.id,
    status: sub.status,
    isClmSoftTrial: isClm,
    trialEndsAt: sub.trialEndsAt,
    trialEnded,
    canDiscontinue,
    showTrialCompletedAlert: canDiscontinue,
    packageCode: sub.package?.code || null,
    packageName: sub.package?.name || null,
    billingCycle: sub.billingCycle,
    planPriceMonthly: Number(sub.package?.priceMonthly || 699),
    planPriceLabel: `$${Number(planPrice).toLocaleString("en-US")}/${
      sub.billingCycle === "YEARLY" ? "year" : "month"
    }`,
    subscribeUrl,
    stripeConfigured: isStripeConfigured(),
    hasStripeSubscriptionId: Boolean(sub.stripeSubscriptionId),
  };
}

/**
 * Stop Stripe (and best-effort GHL) billing for a CLM org subscription.
 */
async function stopClmBilling(prisma, sub, { email = null } = {}) {
  let stripeResolve = {
    stripeSubscriptionId: sub.stripeSubscriptionId || null,
    stripeCustomerId: sub.stripeCustomerId || null,
    source: sub.stripeSubscriptionId ? "db" : null,
  };

  if (!stripeResolve.stripeSubscriptionId) {
    try {
      stripeResolve = await resolveStripeSubscriptionForClm(sub, { email });
    } catch (err) {
      stripeResolve = {
        stripeSubscriptionId: null,
        reason: err?.message || "resolve_failed",
      };
    }
  }

  let stripeCancel = {
    cancelled: false,
    reason: "skipped",
  };

  if (stripeResolve.stripeSubscriptionId) {
    stripeCancel = await cancelStripeSubscription(
      stripeResolve.stripeSubscriptionId,
    );

    // Persist ids we discovered / used
    try {
      await prisma.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          stripeSubscriptionId: stripeResolve.stripeSubscriptionId,
          ...(stripeResolve.stripeCustomerId || stripeCancel.customerId
            ? {
                stripeCustomerId:
                  stripeResolve.stripeCustomerId || stripeCancel.customerId,
              }
            : {}),
        },
      });
    } catch {
      /* non-fatal */
    }
  } else {
    stripeCancel = {
      cancelled: false,
      reason: stripeResolve.reason || "no_stripe_subscription_id",
    };
  }

  // Fallbacks if Stripe cancel did not succeed
  const ghlCancel =
    !stripeCancel.cancelled && sub.ghlSubscriptionId
      ? await cancelGhlSubscription(sub.ghlSubscriptionId)
      : { cancelled: false, reason: stripeCancel.cancelled ? "skipped_stripe_ok" : "no_ghl_subscription_id" };

  const tagResult = await tagGhlContactForDiscontinue(sub.ghlContactId);

  const webhookResult = await fireDiscontinueWebhook({
    event: "lendingcart.clm.discontinue",
    organizationId: sub.organizationId,
    organizationSubscriptionId: sub.id,
    ghlContactId: sub.ghlContactId || null,
    ghlSubscriptionId: sub.ghlSubscriptionId || null,
    stripeSubscriptionId: stripeResolve.stripeSubscriptionId || null,
    discontinuedAt: new Date().toISOString(),
  });

  return {
    stripeResolve,
    stripeCancel,
    ghlCancel,
    tagResult,
    webhookResult,
    billingStopped: Boolean(stripeCancel.cancelled || ghlCancel.cancelled),
  };
}

/**
 * Broker voluntarily stops CLM software after (or at end of) free trial.
 */
async function discontinueClmSoftTrial(prisma, { organizationId, actorUserId }) {
  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ["TRIAL", "ACTIVE"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      package: true,
      organization: { select: { id: true, name: true, email: true } },
    },
  });

  if (!sub || !isClmGhlSoftTrial(sub)) {
    throw Object.assign(
      new Error("No CLM soft-trial subscription found to discontinue"),
      { statusCode: 404, code: "CLM_DISCONTINUE_NOT_FOUND" },
    );
  }

  if (!canShowClmDiscontinue(sub)) {
    throw Object.assign(
      new Error(
        "Discontinue is available after your free trial period ends",
      ),
      { statusCode: 400, code: "CLM_DISCONTINUE_TOO_EARLY" },
    );
  }

  const email = await resolveBrokerEmail(prisma, organizationId, sub);
  const billingStop = await stopClmBilling(prisma, sub, { email });

  const cancelled = await cancelSubscription(prisma, {
    organizationId,
    immediate: true,
  });

  await prisma.organizationSubscription.update({
    where: { id: cancelled.id },
    data: {
      notes: appendSubscriptionNote(
        appendSubscriptionNote(cancelled.notes, CLM_GHL_DISCONTINUED_NOTE),
        `discontinuedBy=${actorUserId || "unknown"}`,
      ),
      ...(billingStop.stripeResolve?.stripeSubscriptionId
        ? {
            stripeSubscriptionId:
              billingStop.stripeResolve.stripeSubscriptionId,
          }
        : {}),
      ...(billingStop.stripeResolve?.stripeCustomerId
        ? { stripeCustomerId: billingStop.stripeResolve.stripeCustomerId }
        : {}),
    },
  });

  // Best-effort confirmation email
  try {
    const admin = await resolveBrokerAdmin(prisma, organizationId);
    const to = admin?.email || sub.organization?.email || email;
    if (to) {
      const name = admin
        ? [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() ||
          "there"
        : "there";
      const subscribeUrl = buildLoanAiPricingUrl();
      const loginUrl = buildBrokerSignInUrl();
      const html = loadTemplate("subscription/clmDiscontinued", {
        name,
        organizationName: sub.organization?.name || "your organization",
        subscribeUrl,
        loginUrl,
      });
      await enqueueEmail({
        prisma,
        to,
        subject: "Loan Automation discontinued — subscribe to continue",
        text: `Hi ${name}, you discontinued Loan Automation. To continue using your account, subscribe at ${subscribeUrl}`,
        html,
        idempotencyKey: `clm-discontinued:${cancelled.id}`,
        provider: "SMTP",
      });
    }
  } catch (mailErr) {
    commonLogs.warn("CLM discontinue confirmation email failed", {
      organizationId,
      error: mailErr?.message,
    });
  }

  commonLogs.info("CLM soft trial discontinued", {
    event: "clm.soft_trial.discontinued",
    organizationId,
    organizationSubscriptionId: cancelled.id,
    actorUserId: actorUserId || null,
    billingStop,
  });

  const billingOk = billingStop.billingStopped;
  return {
    subscriptionId: cancelled.id,
    status: cancelled.status,
    billingStopped: billingOk,
    stripe: {
      configured: isStripeConfigured(),
      resolve: billingStop.stripeResolve,
      cancel: billingStop.stripeCancel,
    },
    ghlBillingStop: {
      apiCancel: billingStop.ghlCancel,
      contactTag: billingStop.tagResult,
      webhook: billingStop.webhookResult,
    },
    message: billingOk
      ? "Loan Automation discontinued. Recurring billing was stopped. Subscribe on LendingCart to restore access."
      : "Loan Automation access discontinued. Recurring billing stop could not be confirmed automatically — support may need to cancel the Stripe/GHL subscription manually.",
  };
}

module.exports = {
  getClmSubscriptionStatus,
  discontinueClmSoftTrial,
  stopClmBilling,
};
