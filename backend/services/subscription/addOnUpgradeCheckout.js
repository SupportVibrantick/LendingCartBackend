const {
  filterAddOnsForPackage,
  flattenPurchasedAddOnCodes,
  computeAddOnUpgradeDelta,
  getAddOnByCode,
  resolveAddOnPriceForPackage,
} = require("../../utils/subscription/addOnCatalog");
const {
  resolveGhlAddOnPriceId,
  getGhlProductId,
  getGhlPriceDetails,
  createAddOnOnlyCheckout,
} = require("../ghl/ghl.payment.service");
const { getPaymentProvider } = require("../stripe/paymentProvider");
const {
  createStripeAddOnOnlyCheckout,
} = require("../stripe/stripeCheckout.service");
const { resolveStripeAddOnPriceId } = require("../stripe/stripePriceMap");

function assertGhlPriceActive(priceDetails) {
  if (!priceDetails?.priceId && !priceDetails?.amount) {
    throw Object.assign(new Error("GHL price is missing or inactive"), {
      statusCode: 503,
      code: "MISSING_GHL_ADDON_PRICE",
    });
  }
}

/** Subscriptions that can load add-on catalog / start checkout. */
const ACTIVE = ["ACTIVE", "TRIAL", "PAST_DUE"];
/** Prefer these when an org has multiple subscription rows. */
const PREFERRED_ACTIVE = ["ACTIVE", "TRIAL"];

const ADDON_DESCRIPTIONS = {
  CRE_PACK: "Unlock CRE & Multifamily loan categories for your team.",
  FEE_AGREEMENT_PACK: "Fee agreements, term sheets, and LOI tools.",
  BUSINESS_LENDING_PACK: "SBA, USDA, and Asset-Based Lending products.",
  LENDER_MARKETPLACE_PACK: "Discover lenders and connect your own network.",
  GHL_STARTER: "GoHighLevel CRM starter suite for your brokerage.",
  GHL_GROWTH: "GoHighLevel Growth automation and marketing suite.",
  WHITE_LABEL: "White-label branding for your broker portal.",
  EXTRA_USER: "Add loan officer or co-broker seats to your plan.",
};

function getOwnedCodeSet(purchasedAddOns) {
  const codes = flattenPurchasedAddOnCodes(purchasedAddOns);
  return new Set(
    codes.filter((c) => String(c).toUpperCase() !== "EXTRA_USER"),
  );
}

function getExtraUserQty(purchasedAddOns) {
  return flattenPurchasedAddOnCodes(purchasedAddOns).filter(
    (c) => c === "EXTRA_USER",
  ).length;
}

const SUB_INCLUDE = {
  package: true,
  organization: true,
  loanAiUser: true,
};

/**
 * Prefer ACTIVE/TRIAL over PAST_DUE when multiple rows exist (common after
 * renewals / failed invoices), so checkout does not latch onto a stale PAST_DUE.
 */
async function getActiveBrokerSubscription(prisma, organizationId) {
  const preferred = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: PREFERRED_ACTIVE },
    },
    include: SUB_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  if (preferred) return preferred;

  return prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE },
    },
    include: SUB_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Catalog + ownership snapshot for broker Settings UI.
 */
async function getAddOnUpgradeOptions(prisma, organizationId) {
  const sub = await getActiveBrokerSubscription(prisma, organizationId);
  if (!sub) {
    throw Object.assign(new Error("No active subscription found"), {
      statusCode: 404,
      code: "NO_SUBSCRIPTION",
    });
  }

  const packageCode = sub.package?.code || null;
  const billingCycle = sub.billingCycle || "MONTHLY";
  const owned = getOwnedCodeSet(sub.purchasedAddOns);
  const extraUserQty = getExtraUserQty(sub.purchasedAddOns);

  const available = filterAddOnsForPackage(packageCode, billingCycle)
    .filter((a) => {
      const code = String(a.code || "").toUpperCase();
      if (code === "EXTRA_USER" || a.quantityBased) return false;
      return !owned.has(code);
    })
    .map((a) => ({
      code: a.code,
      name: a.name,
      priceMonthly: a.priceMonthly,
      note: a.note || null,
      description: ADDON_DESCRIPTIONS[a.code] || a.note || null,
    }));

  const extraUser = getAddOnByCode("EXTRA_USER");
  const extraUserUnit =
    extraUser && packageCode
      ? resolveAddOnPriceForPackage(extraUser, packageCode, billingCycle)
      : null;

  return {
    subscriptionId: sub.id,
    status: sub.status,
    packageCode,
    packageName: sub.package?.name || packageCode,
    billingCycle,
    currentPeriodEnd: sub.currentPeriodEnd,
    purchasedAddOns: Array.isArray(sub.purchasedAddOns)
      ? sub.purchasedAddOns
      : [],
    ownedAddOnCodes: [...owned],
    availableAddOns: available,
    paymentProvider: getPaymentProvider(),
    extraUser: {
      currentQuantity: extraUserQty,
      unitPriceMonthly: extraUserUnit,
      code: "EXTRA_USER",
      name: extraUser?.name || "Additional Users",
      description: ADDON_DESCRIPTIONS.EXTRA_USER,
    },
  };
}

async function buildGhlAddOnLineItems(deltaPurchased, packageCode, billingCycle) {
  const productId = getGhlProductId();
  const items = [];

  for (const addon of deltaPurchased) {
    const resolved = resolveGhlAddOnPriceId(
      addon.code,
      billingCycle,
      packageCode,
    );
    let details = null;
    try {
      details = await getGhlPriceDetails(resolved.priceId, productId);
      assertGhlPriceActive(details);
    } catch (err) {
      throw Object.assign(
        new Error(
          err.message ||
            `GHL price missing for add-on ${addon.code} (${resolved.envKey})`,
        ),
        {
          statusCode: err.statusCode || 503,
          code: err.code || "MISSING_GHL_ADDON_PRICE",
        },
      );
    }

    const unitAmount =
      details?.amount != null
        ? Number(details.amount)
        : billingCycle === "YEARLY"
          ? Number(addon.priceMonthly) * 12
          : Number(addon.priceMonthly);

    const quantity = Math.max(1, Number(addon.quantity) || 1);
    items.push({
      code: addon.code,
      name: quantity > 1 ? `${addon.name} × ${quantity}` : addon.name,
      priceId: resolved.priceId,
      amount: unitAmount,
      qty: quantity,
      itemType: details?.type === "one_time" ? "one_time" : "recurring",
    });
  }

  return items;
}

function buildStripePurchasedAddOns(deltaPurchased) {
  return deltaPurchased.map((addon) => ({
    code: addon.code,
    name: addon.name,
    quantity: Math.max(1, Number(addon.quantity) || 1),
    priceMonthly: addon.priceMonthly,
  }));
}

/** @deprecated Prefer provider-specific builders */
async function buildAddOnLineItems(deltaPurchased, packageCode, billingCycle) {
  return buildGhlAddOnLineItems(deltaPurchased, packageCode, billingCycle);
}

async function createPendingSubscriptionInvoice(
  prisma,
  { sub, organizationId, ghlResult, delta },
) {
  const year = new Date().getFullYear();
  const invoiceNumber = `ADDON-${year}-${Date.now().toString(36).toUpperCase()}`;
  try {
    await prisma.subscriptionInvoice.create({
      data: {
        organizationSubscriptionId: sub.id,
        organizationId,
        invoiceNumber,
        amount: ghlResult.amount,
        currency: ghlResult.currency || "USD",
        billingCycle: sub.billingCycle,
        status: "PENDING",
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        dueDate: new Date(),
        ghlInvoiceId: ghlResult.invoiceId || null,
        notes: JSON.stringify({
          type: "ADDON_UPGRADE",
          addOnCodes: delta.deltaCodes,
          mergedAddOnCodes: delta.mergedCodes,
          checkoutUrl: ghlResult.checkoutUrl,
        }),
        idempotencyKey: `addon-upgrade-pending:${sub.id}:${ghlResult.invoiceId || invoiceNumber}`,
      },
    });
  } catch (invErr) {
    console.warn(
      "addon upgrade pending invoice create warning:",
      invErr.message || invErr,
    );
  }
}

/**
 * Start mid-cycle add-on / extra-user checkout for a broker org.
 */
async function startAddOnUpgradeCheckout(prisma, input = {}) {
  const {
    organizationId,
    actorUser,
    addOnCodes = [],
    extraUserTotal,
    successUrl,
    cancelUrl,
  } = input;

  const sub = await getActiveBrokerSubscription(prisma, organizationId);
  if (!sub) {
    throw Object.assign(new Error("No active subscription found"), {
      statusCode: 404,
      code: "NO_SUBSCRIPTION",
    });
  }

  const status = String(sub.status || "").toUpperCase();
  // Align with catalog load: ACTIVE / TRIAL / PAST_DUE may purchase add-ons.
  // PAST_DUE is common in production when a renewal invoice is unpaid but the
  // broker still has an eligible subscription row.
  if (!ACTIVE.includes(status)) {
    throw Object.assign(
      new Error(
        `Subscription must be ACTIVE, TRIAL, or PAST_DUE to purchase add-ons (current: ${status || "unknown"})`,
      ),
      { statusCode: 409, code: "SUBSCRIPTION_NOT_ELIGIBLE" },
    );
  }

  const packageCode = sub.package?.code;
  const billingCycle = sub.billingCycle || "MONTHLY";

  const delta = computeAddOnUpgradeDelta(
    sub.purchasedAddOns,
    addOnCodes,
    extraUserTotal,
    packageCode,
    billingCycle,
  );

  if (!delta.deltaPurchased?.length) {
    throw Object.assign(
      new Error("Nothing new to purchase — select an add-on or add seats"),
      { statusCode: 400, code: "NO_ADDON_DELTA" },
    );
  }

  const org = sub.organization;
  const loanAiUser =
    sub.loanAiUser ||
    (await prisma.loanAiUser.findFirst({
      where: { brokerOrganizationId: organizationId },
    }));

  const email =
    actorUser?.email || loanAiUser?.email || org?.email || null;
  if (!email) {
    throw Object.assign(new Error("No billing email on file"), {
      statusCode: 400,
      code: "MISSING_BILLING_EMAIL",
    });
  }

  const nameParts = String(actorUser?.name || "")
    .trim()
    .split(/\s+/);
  const firstName =
    loanAiUser?.firstName ||
    actorUser?.firstName ||
    nameParts[0] ||
    "Broker";
  const lastName =
    loanAiUser?.lastName ||
    actorUser?.lastName ||
    nameParts.slice(1).join(" ") ||
    "Admin";

  // Reuse open ADDON_UPGRADE checkout with same delta within 2h
  if (loanAiUser?.id) {
    const existingOpen = await prisma.loanAiGhlCheckout.findFirst({
      where: {
        loanAiUserId: loanAiUser.id,
        packageId: sub.packageId,
        billingCycle,
        status: "CHECKOUT_CREATED",
        paymentStatus: "PENDING",
        checkoutUrl: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    const meta = existingOpen?.metadata;
    if (
      existingOpen?.checkoutUrl &&
      meta &&
      typeof meta === "object" &&
      meta.type === "ADDON_UPGRADE" &&
      meta.organizationSubscriptionId === sub.id &&
      JSON.stringify([...(meta.addOnCodes || [])].sort()) ===
        JSON.stringify([...delta.deltaCodes].sort())
    ) {
      return {
        reused: true,
        checkoutId: existingOpen.id,
        checkoutUrl: existingOpen.checkoutUrl,
        amount: Number(existingOpen.amount),
        currency: existingOpen.currency,
        deltaCodes: delta.deltaCodes,
        deltaPurchased: delta.deltaPurchased,
      };
    }
  }

  // Do NOT set organizationSubscriptionId — unique constraint is used by plan checkout.
  const estimatedAmount = delta.deltaPurchased.reduce((sum, addon) => {
    const qty = Math.max(1, Number(addon.quantity) || 1);
    const unit =
      billingCycle === "YEARLY"
        ? Number(addon.priceMonthly) * 12
        : Number(addon.priceMonthly);
    return sum + unit * qty;
  }, 0);

  const provider = getPaymentProvider();
  if (!provider) {
    throw Object.assign(
      new Error("Payments are not configured. Contact support."),
      { statusCode: 503, code: "PAYMENTS_UNAVAILABLE" },
    );
  }

  let firstPriceId = null;
  if (provider === "stripe") {
    try {
      firstPriceId = resolveStripeAddOnPriceId(
        delta.deltaPurchased[0].code,
        billingCycle,
        packageCode,
      ).priceId;
    } catch (err) {
      throw Object.assign(
        new Error(err.message || "Stripe add-on price not configured"),
        {
          statusCode: err.statusCode || 503,
          code: err.code || "MISSING_STRIPE_ADDON_PRICE",
        },
      );
    }
  }

  const checkoutRow = loanAiUser?.id
    ? await prisma.loanAiGhlCheckout.create({
        data: {
          loanAiUserId: loanAiUser.id,
          packageId: sub.packageId,
          billingCycle,
          status: "PENDING",
          paymentStatus: "PENDING",
          amount: estimatedAmount,
          currency: "USD",
          ghlProductId: provider === "ghl" ? getGhlProductId() : null,
          ghlPriceId: firstPriceId,
          successUrl: successUrl || null,
          cancelUrl: cancelUrl || null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: {
            type: "ADDON_UPGRADE",
            provider,
            organizationSubscriptionId: sub.id,
            organizationId,
            packageCode,
            billingCycle,
            addOnCodes: delta.deltaCodes,
            mergedAddOnCodes: delta.mergedCodes,
          },
        },
      })
    : null;

  let paymentResult;
  try {
    if (provider === "stripe") {
      paymentResult = await createStripeAddOnOnlyCheckout({
        email,
        customerName: [firstName, lastName].filter(Boolean).join(" "),
        packageCode,
        billingCycle,
        purchasedAddOns: buildStripePurchasedAddOns(delta.deltaPurchased),
        successUrl,
        cancelUrl,
        checkoutId: checkoutRow?.id || `addon-upgrade:${sub.id}:${Date.now()}`,
        metadata: {
          type: "ADDON_UPGRADE",
          organizationSubscriptionId: sub.id,
          organizationId,
          addOnCodes: delta.deltaCodes.join(","),
        },
      });
    } else {
      const addOnLineItems = await buildGhlAddOnLineItems(
        delta.deltaPurchased,
        packageCode,
        billingCycle,
      );
      paymentResult = await createAddOnOnlyCheckout({
        email,
        firstName,
        lastName,
        phone: org?.phone || undefined,
        companyName: org?.name || undefined,
        packageCode,
        billingCycle,
        planName: `${sub.package?.name || packageCode} add-ons`,
        successUrl,
        cancelUrl,
        metadata: {
          lendingCartCheckoutId: checkoutRow?.id || `addon-upgrade:${sub.id}`,
          checkoutId: checkoutRow?.id || null,
          type: "ADDON_UPGRADE",
          organizationSubscriptionId: sub.id,
        },
        addOnLineItems,
      });
    }
  } catch (err) {
    if (checkoutRow?.id) {
      await prisma.loanAiGhlCheckout.update({
        where: { id: checkoutRow.id },
        data: {
          status: "FAILED",
          lastError: String(err.message || "checkout_failed").slice(0, 500),
        },
      });
    }
    throw err;
  }

  if (checkoutRow?.id) {
    await prisma.loanAiGhlCheckout.update({
      where: { id: checkoutRow.id },
      data: {
        status: "CHECKOUT_CREATED",
        checkoutUrl: paymentResult.checkoutUrl,
        ghlContactId: paymentResult.ghlContactId || null,
        ghlInvoiceId:
          paymentResult.sessionId || paymentResult.invoiceId || null,
        ghlProductId: paymentResult.productId || null,
        ghlPriceId: paymentResult.priceId || firstPriceId,
        amount:
          paymentResult.amount != null ? paymentResult.amount : estimatedAmount,
        currency: paymentResult.currency || "USD",
        metadata: {
          type: "ADDON_UPGRADE",
          provider,
          organizationSubscriptionId: sub.id,
          organizationId,
          packageCode,
          billingCycle,
          addOnCodes: delta.deltaCodes,
          mergedAddOnCodes: delta.mergedCodes,
          stripeSessionId: paymentResult.sessionId || null,
        },
      },
    });
  } else if (provider === "ghl") {
    await createPendingSubscriptionInvoice(prisma, {
      sub,
      organizationId,
      ghlResult: paymentResult,
      delta,
    });
  }

  return {
    reused: false,
    provider,
    checkoutId: checkoutRow?.id || null,
    checkoutUrl: paymentResult.checkoutUrl,
    amount:
      paymentResult.amount != null ? paymentResult.amount : estimatedAmount,
    currency: paymentResult.currency || "USD",
    sessionId: paymentResult.sessionId || null,
    ghlInvoiceId: paymentResult.invoiceId || null,
    deltaCodes: delta.deltaCodes,
    deltaPurchased: delta.deltaPurchased,
  };
}

module.exports = {
  getAddOnUpgradeOptions,
  startAddOnUpgradeCheckout,
  getActiveBrokerSubscription,
};
