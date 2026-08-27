const {
  provisionBrokerFromLoanAi,
  ensureBrokerAdminAccess,
} = require("../broker/provisionBrokerFromLoanAi");
const {
  assignPlanToOrganization,
  markInvoicePaid,
  changePlan,
} = require("../subscription/subscriptionBilling");
const {
  logPaymentStatusChanged,
} = require("./ghlPaymentLogger");
const {
  syncAgencyLocationForSubscription,
} = require("./organizationGhlAgencyLocation.service");

function deriveOrgName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name) return `${name} Brokerage`;
  const local = String(user.email || "").split("@")[0] || "LoanAI";
  return `${local} Brokerage`;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function resolveOrganizationDetailsFromCheckout(checkout, user, paymentMeta = {}) {
  const meta =
    checkout?.metadata && typeof checkout.metadata === "object"
      ? checkout.metadata
      : {};

  const organizationName =
    String(meta.organizationName || "").trim() || deriveOrgName(user);

  const organizationEmail =
    String(meta.organizationEmail || "").trim().toLowerCase() || user.email;

  const phoneDigits = digitsOnly(
    meta.organizationPhone || meta.phone || paymentMeta.phone,
  );
  const organizationPhone =
    phoneDigits.length >= 10
      ? phoneDigits.slice(0, 15)
      : `1555${String(Date.now()).slice(-7)}`;

  const firstName =
    String(meta.firstName || "").trim() || user.firstName || "Loan";
  const lastName =
    String(meta.lastName || "").trim() || user.lastName || "AI";

  const addOnCodes = Array.isArray(meta.addOnCodes)
    ? meta.addOnCodes.filter(Boolean)
    : [];

  return {
    organizationName,
    organizationEmail,
    organizationPhone,
    firstName,
    lastName,
    addOnCodes,
  };
}

/**
 * Best-effort org → Agency Pro/Elite location mapping.
 * Never throws — subscription activation must not fail because of mapping errors.
 */
async function syncAgencyLocationAfterFulfillment(
  prisma,
  { organizationId, organizationSubscriptionId, packageCode },
) {
  return syncAgencyLocationForSubscription(prisma, {
    organizationId,
    organizationSubscriptionId,
    packageCode,
  });
}

/**
 * Activate LendingCart subscription after a verified GHL payment.
 * Idempotent: safe if checkout already PAID / already provisioned.
 */
async function fulfillPaidGhlCheckout(prisma, io, checkout, paymentMeta = {}) {
  if (!checkout?.id) {
    throw Object.assign(new Error("Checkout is required"), { statusCode: 400 });
  }

  const fresh = await prisma.loanAiGhlCheckout.findUnique({
    where: { id: checkout.id },
    include: {
      loanAiUser: true,
      package: true,
      organizationSubscription: true,
    },
  });

  if (!fresh) {
    throw Object.assign(new Error("Checkout not found"), { statusCode: 404 });
  }

  // Webhook replay: subscription already active — still retry Agency location sync.
  if (fresh.status === "PAID" && fresh.organizationSubscriptionId) {
    const agencyLocation = await syncAgencyLocationAfterFulfillment(prisma, {
      organizationId:
        fresh.organizationSubscription?.organizationId ||
        fresh.loanAiUser?.brokerOrganizationId ||
        null,
      organizationSubscriptionId: fresh.organizationSubscriptionId,
      packageCode: fresh.package?.code || null,
    });

    return {
      alreadyProcessed: true,
      checkoutId: fresh.id,
      organizationSubscriptionId: fresh.organizationSubscriptionId,
      loanAiUserId: fresh.loanAiUserId,
      agencyLocation,
    };
  }

  const user = fresh.loanAiUser;
  if (!user) {
    throw Object.assign(new Error("Checkout user missing"), { statusCode: 404 });
  }

  const ghlContactId = paymentMeta.ghlContactId || fresh.ghlContactId;
  const ghlInvoiceId = paymentMeta.ghlInvoiceId || fresh.ghlInvoiceId;
  const ghlSubscriptionId =
    paymentMeta.ghlSubscriptionId || fresh.ghlSubscriptionId;
  const ghlPriceId = paymentMeta.ghlPriceId || fresh.ghlPriceId;
  const ghlProductId = paymentMeta.ghlProductId || fresh.ghlProductId;
  const ghlTransactionId = paymentMeta.ghlTransactionId || null;

  const periodStart = paymentMeta.currentPeriodStart
    ? new Date(paymentMeta.currentPeriodStart)
    : new Date();
  const periodEnd = paymentMeta.currentPeriodEnd
    ? new Date(paymentMeta.currentPeriodEnd)
    : null;

  let organizationSubscriptionId = fresh.organizationSubscriptionId;
  let organizationId = user.brokerOrganizationId || null;
  let provisioned = false;

  if (user.brokerOrganizationId) {
    const existingSub = await prisma.organizationSubscription.findFirst({
      where: {
        organizationId: user.brokerOrganizationId,
        status: { in: ["TRIAL", "ACTIVE", "PAST_DUE", "PENDING"] },
      },
    });

    if (existingSub) {
      if (
        existingSub.packageId !== fresh.packageId ||
        existingSub.billingCycle !== fresh.billingCycle
      ) {
        await changePlan(prisma, {
          organizationId: user.brokerOrganizationId,
          packageId: fresh.packageId,
          billingCycle: fresh.billingCycle,
          notes: "Updated via GHL payment webhook",
          generateInvoice: true,
        });
      }

      const updated = await prisma.organizationSubscription.update({
        where: { id: existingSub.id },
        data: {
          status: "ACTIVE",
          ghlContactId: ghlContactId || undefined,
          ghlPriceId: ghlPriceId || undefined,
          ghlProductId: ghlProductId || undefined,
          ghlSubscriptionId: ghlSubscriptionId || undefined,
          ghlInvoiceId: ghlInvoiceId || undefined,
          loanAiUserId: user.id,
          ...(periodEnd
            ? {
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              }
            : {}),
        },
      });

      organizationSubscriptionId = updated.id;
      organizationId = user.brokerOrganizationId;

      const pendingInvoice = await prisma.subscriptionInvoice.findFirst({
        where: {
          organizationSubscriptionId: updated.id,
          status: { in: ["PENDING", "DRAFT", "FAILED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (pendingInvoice) {
        await markInvoicePaid(prisma, pendingInvoice.id);
        await prisma.subscriptionInvoice.update({
          where: { id: pendingInvoice.id },
          data: {
            ghlInvoiceId: ghlInvoiceId || pendingInvoice.ghlInvoiceId,
            ghlSubscriptionId:
              ghlSubscriptionId || pendingInvoice.ghlSubscriptionId,
            ghlTransactionId:
              ghlTransactionId || pendingInvoice.ghlTransactionId,
            externalPaymentRef: ghlInvoiceId || pendingInvoice.externalPaymentRef,
          },
        });
      }
    } else {
      const { subscription, invoice } = await assignPlanToOrganization(prisma, {
        organizationId: user.brokerOrganizationId,
        packageId: fresh.packageId,
        billingCycle: fresh.billingCycle,
        trialDays: 0,
        notes: "Activated via GHL payment webhook",
        generateInvoice: true,
        status: "ACTIVE",
        ghlContactId,
        ghlPriceId,
        ghlProductId,
        ghlSubscriptionId,
        ghlInvoiceId,
        loanAiUserId: user.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd || undefined,
      });
      organizationSubscriptionId = subscription.id;
      organizationId = user.brokerOrganizationId;
      if (invoice) {
        await markInvoicePaid(prisma, invoice.id);
        await prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            ghlInvoiceId: ghlInvoiceId || null,
            ghlSubscriptionId: ghlSubscriptionId || null,
            ghlTransactionId: ghlTransactionId || null,
            externalPaymentRef: ghlInvoiceId || null,
          },
        });
      }
    }
  } else {
    const orgDetails = resolveOrganizationDetailsFromCheckout(
      fresh,
      user,
      paymentMeta,
    );

    const result = await provisionBrokerFromLoanAi(prisma, io, user, {
      packageId: fresh.packageId,
      billingCycle: fresh.billingCycle,
      ...orgDetails,
    });

    provisioned = true;
    organizationSubscriptionId = result.subscriptionId;
    organizationId = result.organizationId;

    if (organizationSubscriptionId) {
      await prisma.organizationSubscription.update({
        where: { id: organizationSubscriptionId },
        data: {
          ghlContactId: ghlContactId || null,
          ghlPriceId: ghlPriceId || null,
          ghlProductId: ghlProductId || null,
          ghlSubscriptionId: ghlSubscriptionId || null,
          ghlInvoiceId: ghlInvoiceId || null,
          loanAiUserId: user.id,
        },
      });
    }

    if (result.invoiceId) {
      await prisma.subscriptionInvoice.update({
        where: { id: result.invoiceId },
        data: {
          ghlInvoiceId: ghlInvoiceId || null,
          ghlSubscriptionId: ghlSubscriptionId || null,
          ghlTransactionId: ghlTransactionId || null,
          externalPaymentRef: ghlInvoiceId || null,
        },
      });
    }
  }

  const updatedCheckout = await prisma.loanAiGhlCheckout.update({
    where: { id: fresh.id },
    data: {
      status: "PAID",
      paymentStatus: "PAID",
      ghlContactId: ghlContactId || fresh.ghlContactId,
      ghlInvoiceId: ghlInvoiceId || fresh.ghlInvoiceId,
      ghlSubscriptionId: ghlSubscriptionId || fresh.ghlSubscriptionId,
      ghlProductId: ghlProductId || fresh.ghlProductId,
      ghlPriceId: ghlPriceId || fresh.ghlPriceId,
      organizationSubscriptionId: organizationSubscriptionId || null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      completedAt: new Date(),
      lastError: null,
    },
  });

  // Existing-org renew / partial provision can leave ACTIVE sub with no UserAccount.
  // Always ensure broker login; welcome email is idempotent per buyer email.
  if (organizationId && user) {
    const orgDetails = resolveOrganizationDetailsFromCheckout(
      fresh,
      user,
      paymentMeta,
    );
    try {
      await ensureBrokerAdminAccess(prisma, {
        organizationId,
        loanAiUser: user,
        firstName: orgDetails.firstName,
        lastName: orgDetails.lastName,
        packageName: fresh.package?.name || fresh.package?.code || "Selected Plan",
        // New provision already sent welcome; still safe via idempotency key.
        sendWelcome: true,
        welcomeIdempotencyKey: `broker-welcome:${String(user.email)
          .trim()
          .toLowerCase()}`,
      });
    } catch (accessErr) {
      console.error(
        "ensureBrokerAdminAccess after checkout fulfill failed:",
        accessErr.message || accessErr,
      );
    }
  }

  // After subscription is ACTIVE / checkout PAID — map Agency location (non-fatal).
  const agencyLocation = await syncAgencyLocationAfterFulfillment(prisma, {
    organizationId,
    organizationSubscriptionId,
    packageCode: fresh.package?.code || null,
  });

  logPaymentStatusChanged({
    checkoutId: updatedCheckout.id,
    loanAiUserId: user.id,
    packageId: fresh.packageId,
    billingPeriod: fresh.billingCycle,
    ghlContactId: updatedCheckout.ghlContactId,
    ghlPriceId: updatedCheckout.ghlPriceId,
    ghlInvoiceId: updatedCheckout.ghlInvoiceId,
    ghlSubscriptionId: updatedCheckout.ghlSubscriptionId,
    organizationSubscriptionId,
    previousStatus: fresh.paymentStatus,
    paymentStatus: "PAID",
    status: "PAID",
    amount: fresh.amount,
    currency: fresh.currency,
    reason: "checkout_fulfilled",
  });

  return {
    alreadyProcessed: false,
    checkoutId: updatedCheckout.id,
    organizationSubscriptionId,
    organizationId,
    loanAiUserId: user.id,
    provisioned,
    agencyLocation,
  };
}

/**
 * Mark checkout failed from webhook without activating access.
 */
async function markCheckoutPaymentFailed(prisma, checkout, reason) {
  if (!checkout?.id) return null;
  return prisma.loanAiGhlCheckout.update({
    where: { id: checkout.id },
    data: {
      status: "FAILED",
      paymentStatus: "FAILED",
      lastError: String(reason || "Payment failed").slice(0, 1000),
    },
  });
}

module.exports = {
  fulfillPaidGhlCheckout,
  markCheckoutPaymentFailed,
  deriveOrgName,
  syncAgencyLocationAfterFulfillment,
};
