const { applyAddOnUpgrade } = require("./subscriptionBilling");

/**
 * Fulfill ADDON_UPGRADE when payment webhook has no LoanAiGhlCheckout
 * (broker orgs without a linked Loan AI user).
 */
async function tryFulfillAddOnUpgradeFromInvoice(prisma, ids = {}) {
  if (!ids.ghlInvoiceId) return null;

  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { ghlInvoiceId: ids.ghlInvoiceId },
    orderBy: { createdAt: "desc" },
  });
  if (!invoice) return null;

  let meta = null;
  try {
    meta =
      invoice.notes && String(invoice.notes).trim().startsWith("{")
        ? JSON.parse(invoice.notes)
        : null;
  } catch {
    meta = null;
  }
  if (!meta || meta.type !== "ADDON_UPGRADE") return null;

  if (invoice.status === "PAID") {
    return {
      action: "addon_upgrade_already_paid",
      organizationSubscriptionId: invoice.organizationSubscriptionId,
      alreadyProcessed: true,
    };
  }

  const deltaCodes = Array.isArray(meta.addOnCodes) ? meta.addOnCodes : [];
  if (deltaCodes.length === 0) return null;

  const result = await applyAddOnUpgrade(prisma, {
    organizationSubscriptionId: invoice.organizationSubscriptionId,
    deltaCodes,
    notes: "Add-ons unlocked via GHL payment (invoice track)",
    ghlInvoiceId: ids.ghlInvoiceId || invoice.ghlInvoiceId,
    ghlSubscriptionId: ids.ghlSubscriptionId || null,
    ghlTransactionId: ids.ghlTransactionId || null,
    markPaid: false,
  });

  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ghlSubscriptionId:
        ids.ghlSubscriptionId || invoice.ghlSubscriptionId || null,
      ghlTransactionId: ids.ghlTransactionId || invoice.ghlTransactionId || null,
      externalPaymentRef: ids.ghlInvoiceId || invoice.externalPaymentRef,
      notes: JSON.stringify({
        ...meta,
        fulfilledAt: new Date().toISOString(),
      }),
    },
  });

  return {
    action: "addon_upgrade_paid",
    organizationSubscriptionId: result.subscription.id,
    alreadyProcessed: false,
  };
}

module.exports = {
  tryFulfillAddOnUpgradeFromInvoice,
};
