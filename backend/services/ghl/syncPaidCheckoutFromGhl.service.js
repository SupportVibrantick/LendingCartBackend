const { getGhlInvoice } = require("./ghl.payment.service");
const { fulfillPaidGhlCheckout } = require("./fulfillGhlCheckout");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("./ghlCheckoutErrors");

function isGhlInvoicePaid(invoice) {
  if (!invoice || typeof invoice !== "object") return false;
  const status = String(invoice.status || "").trim().toLowerCase();
  if (["paid", "completed", "success", "succeeded"].includes(status)) {
    return true;
  }
  if (invoice.lastPaidAt) return true;
  const paid = Number(invoice.amountPaid);
  const total = Number(invoice.total ?? invoice.invoiceTotal);
  if (Number.isFinite(paid) && paid > 0) {
    if (!Number.isFinite(total) || total <= 0) return true;
    return paid + 0.001 >= total;
  }
  return false;
}

/**
 * When GHL webhooks cannot reach localhost (or are delayed), the Loan AI
 * "I already paid" action polls the invoice and fulfills if paid.
 */
async function syncPaidCheckoutFromGhl(prisma, io, loanAiUser, { checkoutId } = {}) {
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
    // Already fulfilled?
    const paid = await prisma.loanAiGhlCheckout.findFirst({
      where: { loanAiUserId: loanAiUser.id, status: "PAID" },
      orderBy: { completedAt: "desc" },
      include: { package: true },
    });
    if (paid) {
      return {
        synced: true,
        alreadyPaid: true,
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
      checkoutId: checkout.id,
      paymentStatus: "PAID",
      status: "PAID",
      packageCode: checkout.package?.code || null,
    };
  }

  if (!checkout.ghlInvoiceId) {
    throw checkoutError(CHECKOUT_ERROR_CODES.CHECKOUT_CREATE_FAILED, 502);
  }

  let invoice;
  try {
    invoice = await getGhlInvoice(checkout.ghlInvoiceId);
  } catch (err) {
    console.error(
      "syncPaidCheckoutFromGhl get invoice failed:",
      err.message || err,
    );
    throw checkoutError(CHECKOUT_ERROR_CODES.GHL_API_FAILED, 502);
  }

  if (!isGhlInvoicePaid(invoice)) {
    return {
      synced: false,
      alreadyPaid: false,
      checkoutId: checkout.id,
      paymentStatus: checkout.paymentStatus,
      status: checkout.status,
      invoiceStatus: invoice?.status || null,
      packageCode: checkout.package?.code || null,
      message:
        "Payment is not marked paid yet in the payment provider. Wait a moment and try again.",
    };
  }

  const result = await fulfillPaidGhlCheckout(prisma, io, checkout, {
    ghlInvoiceId: checkout.ghlInvoiceId || invoice?._id || invoice?.id,
    ghlContactId: checkout.ghlContactId,
    ghlSubscriptionId:
      checkout.ghlSubscriptionId || invoice?.subscriptionId || null,
    ghlPriceId: checkout.ghlPriceId,
    ghlProductId: checkout.ghlProductId,
    phone:
      invoice?.contactDetails?.phoneNo ||
      invoice?.contactDetails?.phone ||
      null,
    source: "client_sync",
  });

  return {
    synced: true,
    alreadyPaid: true,
    checkoutId: result.checkoutId || checkout.id,
    paymentStatus: "PAID",
    status: "PAID",
    packageCode: checkout.package?.code || null,
    organizationId: result.organizationId || null,
    organizationSubscriptionId: result.organizationSubscriptionId || null,
    provisioned: Boolean(result.provisioned),
  };
}

module.exports = {
  isGhlInvoicePaid,
  syncPaidCheckoutFromGhl,
};
