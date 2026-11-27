const {
  retrieveStripeCheckoutSession,
  extractAddOnCodesFromStripeSession,
  isStripeCheckoutSessionPaid,
} = require("./stripeCheckout.service");
const { fulfillPaidGhlCheckout } = require("../ghl/fulfillGhlCheckout");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("../ghl/ghlCheckoutErrors");

/**
 * Merge add-ons chosen on Stripe Checkout (incl. optional_items) into metadata.
 */
async function mergeStripeSessionAddOnsIntoCheckout(prisma, checkout, sessionId) {
  if (!checkout?.id || !sessionId) return checkout;
  let stripeAddOnCodes = [];
  try {
    stripeAddOnCodes = await extractAddOnCodesFromStripeSession(sessionId);
  } catch {
    return checkout;
  }
  if (!stripeAddOnCodes.length) return checkout;

  const meta =
    checkout.metadata && typeof checkout.metadata === "object"
      ? { ...checkout.metadata }
      : {};
  const existing = Array.isArray(meta.addOnCodes)
    ? meta.addOnCodes.map(String)
    : [];
  // Prefer Stripe session line items as source of truth after checkout.
  meta.addOnCodes = stripeAddOnCodes;
  meta.stripeResolvedAddOnCodes = stripeAddOnCodes;
  if (existing.length) meta.preselectedAddOnCodes = existing;

  return prisma.loanAiGhlCheckout.update({
    where: { id: checkout.id },
    data: { metadata: meta },
    include: {
      package: true,
      loanAiUser: true,
    },
  });
}

function getMetaCheckoutId(session) {
  return (
    session?.client_reference_id ||
    session?.metadata?.lendingCartCheckoutId ||
    null
  );
}

function getStripeIdsFromSession(session) {
  const subscription =
    typeof session?.subscription === "string"
      ? session.subscription
      : session?.subscription?.id || null;
  const customer =
    typeof session?.customer === "string"
      ? session.customer
      : session?.customer?.id || null;
  return {
    stripeSessionId: session?.id || null,
    stripeSubscriptionId: subscription,
    stripeCustomerId: customer,
  };
}

/**
 * Poll Stripe Checkout Session and fulfill when paid.
 */
async function syncPaidCheckoutFromStripe(
  prisma,
  io,
  loanAiUser,
  { checkoutId, sessionId } = {},
) {
  if (!loanAiUser?.id) {
    throw checkoutError(CHECKOUT_ERROR_CODES.UNAUTHORIZED, 401);
  }

  let checkout = null;
  if (checkoutId) {
    checkout = await prisma.loanAiGhlCheckout.findFirst({
      where: { id: checkoutId, loanAiUserId: loanAiUser.id },
      include: { package: true },
    });
  }

  if (!checkout && sessionId) {
    checkout = await prisma.loanAiGhlCheckout.findFirst({
      where: {
        loanAiUserId: loanAiUser.id,
        OR: [
          { ghlInvoiceId: String(sessionId) },
          {
            metadata: {
              path: ["stripeSessionId"],
              equals: String(sessionId),
            },
          },
        ],
      },
      include: { package: true },
    });
  }

  if (!checkout) {
    checkout = await prisma.loanAiGhlCheckout.findFirst({
      where: {
        loanAiUserId: loanAiUser.id,
        status: { in: ["PENDING", "CHECKOUT_CREATED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { package: true },
    });
  }

  if (!checkout) {
    const paid = await prisma.loanAiGhlCheckout.findFirst({
      where: { loanAiUserId: loanAiUser.id, status: "PAID" },
      orderBy: { completedAt: "desc" },
      include: { package: true },
    });
    if (paid) {
      return {
        synced: true,
        alreadyPaid: true,
        provider: "stripe",
        checkoutId: paid.id,
        paymentStatus: "PAID",
        status: "PAID",
        packageCode: paid.package?.code || null,
      };
    }
    throw checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 404);
  }

  if (checkout.status === "PAID" && checkout.organizationSubscriptionId) {
    return {
      synced: true,
      alreadyPaid: true,
      provider: "stripe",
      checkoutId: checkout.id,
      paymentStatus: "PAID",
      status: "PAID",
      packageCode: checkout.package?.code || null,
    };
  }

  const meta =
    checkout.metadata && typeof checkout.metadata === "object"
      ? checkout.metadata
      : {};
  const resolvedSessionId =
    sessionId || meta.stripeSessionId || meta.sessionId || null;

  if (!resolvedSessionId) {
    return {
      synced: false,
      provider: "stripe",
      checkoutId: checkout.id,
      paymentStatus: checkout.paymentStatus,
      status: checkout.status,
      message: "Stripe session not found on checkout yet",
    };
  }

  const session = await retrieveStripeCheckoutSession(resolvedSessionId);
  if (!session) {
    throw checkoutError(CHECKOUT_ERROR_CODES.GHL_API_FAILED, 502);
  }

  if (!isStripeCheckoutSessionPaid(session)) {
    return {
      synced: false,
      provider: "stripe",
      checkoutId: checkout.id,
      paymentStatus: checkout.paymentStatus,
      status: checkout.status,
      stripeStatus: session.status,
      stripePaymentStatus: session.payment_status,
    };
  }

  const ids = getStripeIdsFromSession(session);
  const checkoutWithAddOns = await mergeStripeSessionAddOnsIntoCheckout(
    prisma,
    checkout,
    ids.stripeSessionId || resolvedSessionId,
  );
  const fulfilled = await fulfillPaidGhlCheckout(
    prisma,
    io,
    checkoutWithAddOns || checkout,
    {
      provider: "stripe",
      ...ids,
      ghlInvoiceId: ids.stripeSessionId,
      ghlSubscriptionId: ids.stripeSubscriptionId,
    },
  );

  return {
    synced: true,
    provider: "stripe",
    checkoutId: checkout.id,
    paymentStatus: "PAID",
    status: "PAID",
    packageCode:
      fulfilled?.packageCode || checkout.package?.code || null,
    organizationSubscriptionId:
      fulfilled?.organizationSubscriptionId || null,
  };
}

/**
 * Fulfill from Stripe webhook (checkout.session.completed).
 */
async function fulfillStripeCheckoutSession(prisma, io, session) {
  if (!isStripeCheckoutSessionPaid(session)) {
    return { action: "stripe_checkout_not_paid", sessionId: session?.id };
  }

  const checkoutId = getMetaCheckoutId(session);
  if (!checkoutId) {
    return {
      action: "stripe_checkout_missing_checkout_id",
      sessionId: session?.id,
    };
  }

  let checkout = null;
  const looksLikeUuid =
    typeof checkoutId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      checkoutId,
    );
  if (looksLikeUuid) {
    checkout = await prisma.loanAiGhlCheckout.findUnique({
      where: { id: checkoutId },
      include: { package: true },
    });
  }

  if (!checkout) {
    // Fallback: ADDON_UPGRADE paid without a LoanAiGhlCheckout row
    // (legacy broker orgs that had no LoanAiUser / checkout record).
    const meta = session?.metadata || {};
    const isAddOnUpgrade =
      String(meta.type || "").toUpperCase() === "ADDON_UPGRADE";
    const organizationSubscriptionId =
      meta.organizationSubscriptionId || null;
    let addOnCodes = String(meta.addOnCodes || "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (!addOnCodes.length && session?.id) {
      try {
        addOnCodes = await extractAddOnCodesFromStripeSession(session.id);
      } catch {
        addOnCodes = [];
      }
    }
    if (isAddOnUpgrade && organizationSubscriptionId && addOnCodes.length) {
      const { applyAddOnUpgrade } = require("../subscription/subscriptionBilling");
      const upgrade = await applyAddOnUpgrade(prisma, {
        organizationSubscriptionId,
        deltaCodes: addOnCodes,
        notes: "Add-ons unlocked via Stripe (checkout-row fallback)",
        ghlInvoiceId: session?.id || null,
        ghlSubscriptionId:
          typeof session?.subscription === "string"
            ? session.subscription
            : session?.subscription?.id || null,
        markPaid: true,
      });
      return {
        action: "stripe_addon_upgrade_fulfilled_without_checkout_row",
        checkoutId,
        sessionId: session?.id,
        organizationSubscriptionId: upgrade.subscription.id,
      };
    }

    return {
      action: "stripe_checkout_not_found",
      checkoutId,
      sessionId: session?.id,
    };
  }

  const ids = getStripeIdsFromSession(session);
  const nextMeta = {
    ...(checkout.metadata && typeof checkout.metadata === "object"
      ? checkout.metadata
      : {}),
    provider: "stripe",
    stripeSessionId: ids.stripeSessionId,
    stripeSubscriptionId: ids.stripeSubscriptionId,
    stripeCustomerId: ids.stripeCustomerId,
  };

  await prisma.loanAiGhlCheckout.update({
    where: { id: checkout.id },
    data: {
      metadata: nextMeta,
      ghlInvoiceId: ids.stripeSessionId || checkout.ghlInvoiceId,
      ghlSubscriptionId:
        ids.stripeSubscriptionId || checkout.ghlSubscriptionId,
      checkoutUrl: checkout.checkoutUrl || session.url || null,
    },
  });

  let fresh = await prisma.loanAiGhlCheckout.findUnique({
    where: { id: checkout.id },
    include: { package: true, loanAiUser: true },
  });

  fresh =
    (await mergeStripeSessionAddOnsIntoCheckout(
      prisma,
      fresh,
      ids.stripeSessionId || session?.id,
    )) || fresh;

  const fulfilled = await fulfillPaidGhlCheckout(prisma, io, fresh, {
    provider: "stripe",
    ...ids,
    ghlInvoiceId: ids.stripeSessionId,
    ghlSubscriptionId: ids.stripeSubscriptionId,
  });

  // Persist Stripe ids on org subscription when present
  if (fulfilled?.organizationSubscriptionId && ids.stripeSubscriptionId) {
    try {
      await prisma.organizationSubscription.update({
        where: { id: fulfilled.organizationSubscriptionId },
        data: {
          stripeSubscriptionId: ids.stripeSubscriptionId,
          ...(ids.stripeCustomerId
            ? { stripeCustomerId: ids.stripeCustomerId }
            : {}),
        },
      });
    } catch {
      // non-fatal
    }
  }

  return {
    action: "stripe_checkout_fulfilled",
    checkoutId: checkout.id,
    organizationSubscriptionId: fulfilled?.organizationSubscriptionId || null,
    packageCode: fulfilled?.packageCode || checkout.package?.code || null,
  };
}

module.exports = {
  syncPaidCheckoutFromStripe,
  fulfillStripeCheckoutSession,
  getMetaCheckoutId,
  getStripeIdsFromSession,
};
