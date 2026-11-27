const { getPaymentProvider } = require("../stripe/paymentProvider");
const {
  createStripeSubscriptionCheckout,
} = require("../stripe/stripeCheckout.service");
const { resolveStripePriceId } = require("../stripe/stripePriceMap");
const { createSubscriptionCheckout } = require("../ghl/ghl.payment.service");
const { getPackagePrice } = require("./subscriptionBilling");
const {
  normalizePackageCode,
  resolveGhlPriceId,
  getGhlProductIdForPackage,
} = require("../ghl/ghlPriceMap");
const {
  getAddOnByCode,
  isAddOnAvailableForPackage,
  resolveAddOnPriceForPackage,
} = require("../../utils/subscription/addOnCatalog");
const {
  ensureLoanAiBillingUser,
} = require("./ensureLoanAiBillingUser");

const ACTIVE = ["ACTIVE", "TRIAL", "PAST_DUE"];

const PACKAGE_RANK = {
  BASIC: 1,
  STARTER: 1,
  PRO: 2,
  ELITE: 3,
};

function packageRank(code) {
  const normalized = normalizePackageCode(code);
  return PACKAGE_RANK[normalized] || 0;
}

function canUpgradePackage(fromCode, toCode) {
  return packageRank(toCode) > packageRank(fromCode);
}

function remainingTrialDays(sub) {
  if (String(sub?.status || "").toUpperCase() !== "TRIAL") return 0;
  const ends = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  if (!ends || Number.isNaN(ends.getTime())) return 0;
  const ms = ends.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

async function getActiveBrokerSubscription(prisma, organizationId) {
  const preferred = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    include: {
      package: true,
      organization: true,
      loanAiUser: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (preferred) return preferred;

  return prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE },
    },
    include: {
      package: true,
      organization: true,
      loanAiUser: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mid-cycle plan tier upgrade (BASIC/STARTER → PRO/ELITE, PRO → ELITE).
 */
async function startPlanUpgradeCheckout(prisma, input = {}) {
  const {
    organizationId,
    actorUser,
    packageId,
    packageCode: requestedCode,
    billingCycle: requestedCycle,
    extraUserTotal: requestedExtraUsers = 0,
    addOnCodes: requestedAddOnCodes = [],
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
  if (!ACTIVE.includes(status)) {
    throw Object.assign(
      new Error(
        `Subscription must be ACTIVE, TRIAL, or PAST_DUE to upgrade (current: ${status || "unknown"})`,
      ),
      { statusCode: 409, code: "SUBSCRIPTION_NOT_ELIGIBLE" },
    );
  }

  const targetPkg = await prisma.subscriptionPackage.findFirst({
    where: packageId
      ? { id: packageId, isActive: true }
      : {
          code: normalizePackageCode(requestedCode),
          isActive: true,
        },
  });

  if (!targetPkg) {
    throw Object.assign(new Error("Target plan not found or inactive"), {
      statusCode: 404,
      code: "INVALID_PACKAGE",
    });
  }

  const fromCode = sub.package?.code || null;
  const toCode = targetPkg.code;
  if (!canUpgradePackage(fromCode, toCode)) {
    throw Object.assign(
      new Error(
        `Cannot upgrade from ${fromCode || "current plan"} to ${toCode}. Only higher tiers are allowed.`,
      ),
      { statusCode: 400, code: "INVALID_PLAN_UPGRADE" },
    );
  }

  const billingCycle = ["MONTHLY", "YEARLY"].includes(
    String(requestedCycle || "").toUpperCase(),
  )
    ? String(requestedCycle).toUpperCase()
    : sub.billingCycle || "MONTHLY";

  const org = sub.organization;
  const email =
    actorUser?.email ||
    sub.loanAiUser?.email ||
    org?.email ||
    null;
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
    sub.loanAiUser?.firstName ||
    actorUser?.firstName ||
    nameParts[0] ||
    "Broker";
  const lastName =
    sub.loanAiUser?.lastName ||
    actorUser?.lastName ||
    nameParts.slice(1).join(" ") ||
    "Admin";

  const loanAiUser =
    sub.loanAiUser ||
    (await ensureLoanAiBillingUser(prisma, {
      organizationId,
      subscriptionId: sub.id,
      email,
      firstName,
      lastName,
    }));

  const extraUserTotal = Math.max(
    0,
    Math.floor(Number(requestedExtraUsers) || 0),
  );

  const ownedNonSeat = new Set(
    (Array.isArray(sub.purchasedAddOns) ? sub.purchasedAddOns : [])
      .map((row) => String(row?.code || "").toUpperCase())
      .filter((code) => code && code !== "EXTRA_USER"),
  );

  const selectedFeatureCodes = [
    ...new Set(
      (Array.isArray(requestedAddOnCodes) ? requestedAddOnCodes : [])
        .map((code) => String(code || "").trim().toUpperCase())
        .filter((code) => {
          if (!code || code === "EXTRA_USER" || ownedNonSeat.has(code)) {
            return false;
          }
          const addOn = getAddOnByCode(code);
          return Boolean(addOn && isAddOnAvailableForPackage(addOn, toCode));
        }),
    ),
  ].sort();

  if (loanAiUser?.id) {
    const existingOpen = await prisma.loanAiGhlCheckout.findFirst({
      where: {
        loanAiUserId: loanAiUser.id,
        packageId: targetPkg.id,
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
    const existingFeatureCodes = Array.isArray(meta?.featureAddOnCodes)
      ? [...meta.featureAddOnCodes].map((c) => String(c).toUpperCase()).sort()
      : String(meta?.featureAddOnCodes || "")
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
          .sort();
    const existingExtra = Math.max(
      0,
      Math.floor(Number(meta?.extraUserTotal) || 0),
    );
    if (
      existingOpen?.checkoutUrl &&
      meta &&
      typeof meta === "object" &&
      meta.type === "PLAN_UPGRADE" &&
      meta.organizationSubscriptionId === sub.id &&
      existingExtra === extraUserTotal &&
      JSON.stringify(existingFeatureCodes) ===
        JSON.stringify(selectedFeatureCodes)
    ) {
      return {
        reused: true,
        checkoutId: existingOpen.id,
        checkoutUrl: existingOpen.checkoutUrl,
        amount: Number(existingOpen.amount),
        currency: existingOpen.currency,
        fromPackageCode: fromCode,
        toPackageCode: toCode,
        billingCycle,
        extraUserTotal,
        featureAddOnCodes: selectedFeatureCodes,
      };
    }
  }

  const purchasedAddOnsForCheckout = [
    ...selectedFeatureCodes.map((code) => ({ code, quantity: 1 })),
    ...(extraUserTotal > 0
      ? [{ code: "EXTRA_USER", quantity: extraUserTotal }]
      : []),
  ];

  const featureAmount = selectedFeatureCodes.reduce((sum, code) => {
    const addOn = getAddOnByCode(code);
    const unit = addOn
      ? resolveAddOnPriceForPackage(addOn, toCode, billingCycle)
      : 0;
    return (
      sum + (billingCycle === "YEARLY" ? Number(unit) * 12 : Number(unit) || 0)
    );
  }, 0);

  const extraUserAddOn = getAddOnByCode("EXTRA_USER");
  const extraUnit =
    extraUserTotal > 0 && extraUserAddOn
      ? resolveAddOnPriceForPackage(extraUserAddOn, toCode, billingCycle)
      : 0;
  const extraAmount =
    billingCycle === "YEARLY"
      ? extraUnit * 12 * extraUserTotal
      : extraUnit * extraUserTotal;
  const addOnCodes = [
    ...selectedFeatureCodes,
    ...Array.from({ length: extraUserTotal }, () => "EXTRA_USER"),
  ];

  const estimatedAmount =
    getPackagePrice(targetPkg, billingCycle) + featureAmount + extraAmount;
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
      firstPriceId = resolveStripePriceId(toCode, billingCycle).priceId;
    } catch (err) {
      throw Object.assign(
        new Error(err.message || "Stripe plan price not configured"),
        {
          statusCode: err.statusCode || 503,
          code: err.code || "MISSING_STRIPE_PRICE",
        },
      );
    }
  } else {
    try {
      firstPriceId = resolveGhlPriceId(toCode, billingCycle).priceId;
    } catch (err) {
      throw Object.assign(
        new Error(err.message || "GHL plan price not configured"),
        {
          statusCode: err.statusCode || 503,
          code: err.code || "MISSING_GHL_PRICE",
        },
      );
    }
  }

  if (!loanAiUser?.id) {
    throw Object.assign(
      new Error(
        "Could not create a billing profile for this brokerage. Contact support.",
      ),
      { statusCode: 409, code: "MISSING_LOAN_AI_USER" },
    );
  }

  const trialDaysLeft = remainingTrialDays(sub);
  const checkoutRow = await prisma.loanAiGhlCheckout.create({
    data: {
      loanAiUserId: loanAiUser.id,
      packageId: targetPkg.id,
      billingCycle,
      status: "PENDING",
      paymentStatus: "PENDING",
      amount: estimatedAmount,
      currency: "USD",
      ghlProductId:
        provider === "ghl" ? getGhlProductIdForPackage(toCode) : null,
      ghlPriceId: firstPriceId,
      successUrl: successUrl || null,
      cancelUrl: cancelUrl || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        type: "PLAN_UPGRADE",
        provider,
        organizationSubscriptionId: sub.id,
        organizationId,
        fromPackageCode: fromCode,
        toPackageCode: toCode,
        billingCycle,
        extraUserTotal,
        featureAddOnCodes: selectedFeatureCodes,
        addOnCodes,
        withFreeTrial: trialDaysLeft > 0,
        trialPeriodDays: trialDaysLeft,
      },
    },
  });

  let paymentResult;
  try {
    if (provider === "stripe") {
      paymentResult = await createStripeSubscriptionCheckout({
        email,
        customerName: [firstName, lastName].filter(Boolean).join(" "),
        packageCode: toCode,
        billingCycle,
        purchasedAddOns: purchasedAddOnsForCheckout,
        successUrl,
        cancelUrl,
        checkoutId: checkoutRow.id,
        trialPeriodDays: trialDaysLeft,
        offerOptionalAddOns: false,
        metadata: {
          type: "PLAN_UPGRADE",
          organizationSubscriptionId: sub.id,
          organizationId,
          fromPackageCode: fromCode,
          toPackageCode: toCode,
          extraUserTotal: String(extraUserTotal),
          featureAddOnCodes: selectedFeatureCodes.join(","),
          withFreeTrial: trialDaysLeft > 0 ? "true" : "false",
          trialPeriodDays: trialDaysLeft > 0 ? String(trialDaysLeft) : "0",
        },
      });
    } else {
      paymentResult = await createSubscriptionCheckout({
        email,
        firstName,
        lastName,
        phone: org?.phone || undefined,
        companyName: org?.name || undefined,
        packageCode: toCode,
        billingCycle,
        planName: targetPkg.name || toCode,
        successUrl,
        cancelUrl,
        metadata: {
          lendingCartCheckoutId: checkoutRow.id,
          checkoutId: checkoutRow.id,
          type: "PLAN_UPGRADE",
          organizationSubscriptionId: sub.id,
          fromPackageCode: fromCode,
          toPackageCode: toCode,
          extraUserTotal,
          featureAddOnCodes: selectedFeatureCodes,
        },
      });
    }
  } catch (err) {
    await prisma.loanAiGhlCheckout.update({
      where: { id: checkoutRow.id },
      data: {
        status: "FAILED",
        lastError: String(err.message || "checkout_failed").slice(0, 500),
      },
    });
    throw err;
  }

  await prisma.loanAiGhlCheckout.update({
    where: { id: checkoutRow.id },
    data: {
      status: "CHECKOUT_CREATED",
      checkoutUrl: paymentResult.checkoutUrl,
      ghlContactId: paymentResult.ghlContactId || null,
      ghlInvoiceId:
        paymentResult.sessionId || paymentResult.invoiceId || null,
      ghlProductId:
        paymentResult.productId || getGhlProductIdForPackage(toCode),
      ghlPriceId: paymentResult.priceId || firstPriceId,
      amount:
        paymentResult.amount != null ? paymentResult.amount : estimatedAmount,
      currency: paymentResult.currency || "USD",
      metadata: {
        type: "PLAN_UPGRADE",
        provider,
        organizationSubscriptionId: sub.id,
        organizationId,
        fromPackageCode: fromCode,
        toPackageCode: toCode,
        billingCycle,
        extraUserTotal,
        featureAddOnCodes: selectedFeatureCodes,
        addOnCodes,
        stripeSessionId: paymentResult.sessionId || null,
      },
    },
  });

  return {
    reused: false,
    checkoutId: checkoutRow.id,
    checkoutUrl: paymentResult.checkoutUrl,
    amount:
      paymentResult.amount != null ? paymentResult.amount : estimatedAmount,
    currency: paymentResult.currency || "USD",
    provider,
    fromPackageCode: fromCode,
    toPackageCode: toCode,
    billingCycle,
    extraUserTotal,
    featureAddOnCodes: selectedFeatureCodes,
  };
}

module.exports = {
  PACKAGE_RANK,
  packageRank,
  canUpgradePackage,
  startPlanUpgradeCheckout,
};
