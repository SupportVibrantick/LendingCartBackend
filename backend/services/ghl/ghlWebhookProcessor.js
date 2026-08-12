const {
  handleGhlPaymentSuccess,
  handleGhlPaymentFailure,
  handleGhlSubscriptionCancelled,
  handleGhlSubscriptionPastDue,
  handleGhlSubscriptionExpired,
} = require("./ghlSubscriptionLifecycle");
const {
  logWebhookReceived,
  logWebhookProcessed,
  logWebhookDuplicate,
  logWebhookFailed,
  logWebhookIgnored,
} = require("./ghlPaymentLogger");

const PAID_EVENT_TYPES = new Set([
  "InvoicePaid",
  "invoice.paid",
  "OrderCreate",
  "OrderStatusUpdate",
  "PaymentReceived",
  "payment.captured",
  "SubscriptionCreate",
  "subscription.active",
  "subscription.charged",
]);

const FAILED_EVENT_TYPES = new Set([
  "InvoiceVoid",
  "PaymentFailed",
  "payment.failed",
  "payment.canceled",
  "payment.cancelled",
]);

const CANCELLED_EVENT_TYPES = new Set([
  "OrderCancel",
  "SubscriptionCancel",
  "subscription.cancelled",
  "subscription.canceled",
  "InvoiceVoided",
]);

const EXPIRED_EVENT_TYPES = new Set([
  "subscription.expired",
  "SubscriptionExpired",
  "SubscriptionExpire",
]);

const PAST_DUE_EVENT_TYPES = new Set([
  "subscription.unpaid",
  "subscription.past_due",
  "SubscriptionPastDue",
  "InvoiceOverdue",
]);

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function pickFirst(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return null;
}

function normalizeEventType(body = {}) {
  return pickFirst(body.type, body.event, body.eventType, body.name) || "Unknown";
}

function extractCheckoutIdFromText(text) {
  if (!text) return null;
  const match = String(text).match(
    /LendingCart checkout\s+([0-9a-f-]{36})/i,
  );
  return match?.[1] || null;
}

function firstLineItem(...candidates) {
  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      return asObject(value[0]);
    }
  }
  return {};
}

function extractIds(body = {}) {
  // Nested (invoice/order wrappers) and official root-level InvoicePaid both supported.
  const invoice = asObject(body.invoice || body.data?.invoice || body.data);
  const order = asObject(body.order || body.data?.order);
  const subscription = asObject(
    body.subscription || body.data?.subscription || invoice.subscription,
  );
  // Prefer nested contact, then official root contactDetails, then invoice/order contact.
  const contact = asObject(
    body.contact ||
      body.contactDetails ||
      body.data?.contact ||
      body.data?.contactDetails ||
      invoice.contactDetails ||
      invoice.contact ||
      order.contactSnapshot ||
      order.contact,
  );
  const lineItem = firstLineItem(
    body.items,
    body.invoiceItems,
    body.data?.items,
    body.data?.invoiceItems,
    invoice.items,
    invoice.invoiceItems,
    order.items,
  );

  // Nested invoice ids first, then official root _id, then legacy aliases.
  const ghlInvoiceId = pickFirst(
    invoice._id,
    invoice.id,
    body._id,
    body.invoiceId,
    body.data?.invoiceId,
    order.invoiceId,
  );
  const ghlContactId = pickFirst(
    body.contact?.id,
    body.contact?._id,
    body.contactDetails?.id,
    body.contactDetails?._id,
    contact.id,
    contact._id,
    body.contactId,
    body.data?.contactId,
    invoice.contactId,
    order.contactId,
  );
  const ghlSubscriptionId = pickFirst(
    subscription.id,
    subscription._id,
    subscription.subscriptionId,
    body.subscriptionId,
    body.data?.subscriptionId,
    invoice.subscriptionId,
    order.subscriptionId,
  );
  const ghlPriceId = pickFirst(
    body.priceId,
    body.data?.priceId,
    invoice.priceId,
    order.priceId,
    lineItem.priceId,
  );
  const ghlProductId = pickFirst(
    body.productId,
    body.data?.productId,
    invoice.productId,
    lineItem.productId,
  );
  const ghlTransactionId = pickFirst(
    body.transactionId,
    body.data?.transactionId,
    order.transactionId,
    invoice.transactionId,
  );
  const emailRaw = pickFirst(
    body.contact?.email,
    body.contactDetails?.email,
    contact.email,
    invoice.email,
    body.email,
    body.data?.email,
  );
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const phone = pickFirst(
    body.contact?.phone,
    body.contact?.phoneNo,
    body.contactDetails?.phone,
    body.contactDetails?.phoneNo,
    contact.phone,
    contact.phoneNo,
    body.phone,
  );
  // Checkout UUID is separate from ghlInvoiceId (lendingCartCheckoutId / checkoutId).
  const checkoutId = pickFirst(
    body.lendingCartCheckoutId,
    body.checkoutId,
    body.data?.lendingCartCheckoutId,
    body.data?.checkoutId,
    invoice.lendingCartCheckoutId,
    extractCheckoutIdFromText(
      invoice.description ||
        invoice.name ||
        invoice.termsNotes ||
        body.description ||
        body.name,
    ),
  );

  const status = pickFirst(
    invoice.status,
    order.status,
    subscription.status,
    body.status,
    body.data?.status,
  );

  return {
    ghlInvoiceId,
    ghlContactId,
    ghlSubscriptionId,
    ghlPriceId,
    ghlProductId,
    ghlTransactionId,
    email,
    phone,
    checkoutId,
    status: status ? String(status).toLowerCase() : null,
  };
}

function classifyLifecycle({ eventType, status }) {
  if (EXPIRED_EVENT_TYPES.has(eventType)) return "expired";
  if (CANCELLED_EVENT_TYPES.has(eventType)) return "cancelled";
  if (PAST_DUE_EVENT_TYPES.has(eventType)) return "past_due";
  if (FAILED_EVENT_TYPES.has(eventType)) return "failed";
  if (PAID_EVENT_TYPES.has(eventType)) return "paid";

  if (status) {
    if (["expired"].includes(status)) return "expired";
    if (["cancelled", "canceled"].includes(status)) return "cancelled";
    if (["past_due", "pastdue", "unpaid", "overdue"].includes(status)) {
      return "past_due";
    }
    if (["failed", "void"].includes(status)) return "failed";
    if (["paid", "completed", "success", "succeeded", "active"].includes(status)) {
      return "paid";
    }
  }

  return "unknown";
}

function sanitizePayloadSummary(body = {}, ids = {}) {
  return {
    type: normalizeEventType(body),
    locationId: body.locationId || body.location_id || null,
    webhookId: body.webhookId || body.id || null,
    ghlContactId: ids.ghlContactId || null,
    ghlInvoiceId: ids.ghlInvoiceId || null,
    ghlSubscriptionId: ids.ghlSubscriptionId || null,
    ghlPriceId: ids.ghlPriceId || null,
    hasEmail: Boolean(ids.email),
    checkoutId: ids.checkoutId || null,
    status: ids.status || null,
  };
}

async function findCheckout(prisma, ids, { includePaid = false } = {}) {
  if (ids.checkoutId) {
    const byId = await prisma.loanAiGhlCheckout.findUnique({
      where: { id: ids.checkoutId },
    });
    if (byId) return byId;
  }

  if (ids.ghlInvoiceId) {
    const byInvoice = await prisma.loanAiGhlCheckout.findFirst({
      where: { ghlInvoiceId: ids.ghlInvoiceId },
      orderBy: { createdAt: "desc" },
    });
    if (byInvoice) return byInvoice;
  }

  if (ids.ghlSubscriptionId) {
    const bySub = await prisma.loanAiGhlCheckout.findFirst({
      where: { ghlSubscriptionId: ids.ghlSubscriptionId },
      orderBy: { createdAt: "desc" },
    });
    if (bySub) return bySub;
  }

  const openStatuses = includePaid
    ? ["PENDING", "CHECKOUT_CREATED", "FAILED", "PAID", "CANCELLED"]
    : ["PENDING", "CHECKOUT_CREATED", "FAILED"];

  if (ids.ghlContactId) {
    const byContact = await prisma.loanAiGhlCheckout.findFirst({
      where: {
        ghlContactId: ids.ghlContactId,
        status: { in: openStatuses },
      },
      orderBy: { createdAt: "desc" },
    });
    if (byContact) return byContact;
  }

  if (ids.email) {
    const user = await prisma.loanAiUser.findFirst({
      where: { email: { equals: ids.email, mode: "insensitive" } },
    });
    if (user) {
      const where = {
        loanAiUserId: user.id,
        status: { in: openStatuses },
      };
      if (ids.ghlPriceId && !includePaid) {
        where.ghlPriceId = ids.ghlPriceId;
      }
      return prisma.loanAiGhlCheckout.findFirst({
        where,
        orderBy: { createdAt: "desc" },
      });
    }
  }

  return null;
}

function resolveWebhookId(body = {}) {
  return (
    pickFirst(
      body.webhookId,
      body.webhook_id,
      body.id,
      body.eventId,
      body.data?.webhookId,
    ) ||
    `hash:${require("crypto")
      .createHash("sha256")
      .update(
        JSON.stringify({
          type: normalizeEventType(body),
          invoiceId: body.invoiceId || body.invoice?._id || body.invoice?.id,
          contactId: body.contactId || body.contact?.id,
          subscriptionId: body.subscriptionId,
          timestamp: body.timestamp || body.createdAt,
        }),
      )
      .digest("hex")
      .slice(0, 40)}`
  );
}

/**
 * Process a verified GHL webhook payload.
 * Idempotent via ghl_webhook_events.webhookId unique constraint.
 */
async function processGhlWebhook(prisma, io, body = {}) {
  const eventType = normalizeEventType(body);
  const ids = extractIds(body);
  const lifecycle = classifyLifecycle({ eventType, status: ids.status });
  const webhookId = resolveWebhookId(body);
  const summary = sanitizePayloadSummary(body, ids);

  logWebhookReceived({
    webhookId,
    eventType,
    lifecycle,
    ghlContactId: ids.ghlContactId,
    ghlInvoiceId: ids.ghlInvoiceId,
    ghlSubscriptionId: ids.ghlSubscriptionId,
    ghlPriceId: ids.ghlPriceId,
    status: ids.status,
    checkoutId: ids.checkoutId,
  });

  let eventRow;
  try {
    eventRow = await prisma.ghlWebhookEvent.create({
      data: {
        webhookId,
        eventType,
        status: "RECEIVED",
        ghlContactId: ids.ghlContactId,
        ghlInvoiceId: ids.ghlInvoiceId,
        ghlSubscriptionId: ids.ghlSubscriptionId,
        payloadSummary: summary,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      const existing = await prisma.ghlWebhookEvent.findUnique({
        where: { webhookId },
      });
      logWebhookDuplicate({
        webhookId,
        eventType,
        lifecycle,
        status: existing?.status || "PROCESSED",
        ghlContactId: ids.ghlContactId,
        ghlInvoiceId: ids.ghlInvoiceId,
        ghlSubscriptionId: ids.ghlSubscriptionId,
      });
      return {
        duplicate: true,
        webhookId,
        status: existing?.status || "PROCESSED",
        message: "Webhook already processed",
      };
    }
    throw err;
  }

  try {
    const needsExistingSub =
      lifecycle === "cancelled" ||
      lifecycle === "past_due" ||
      lifecycle === "expired";
    const checkout = await findCheckout(prisma, ids, {
      includePaid: needsExistingSub,
    });

    if (!checkout && lifecycle === "paid") {
      await prisma.ghlWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "IGNORED",
          processedAt: new Date(),
          errorMessage: "No matching LendingCart checkout",
        },
      });
      logWebhookIgnored({
        webhookId,
        eventType,
        lifecycle,
        reason: "no_matching_checkout",
        ghlInvoiceId: ids.ghlInvoiceId,
        ghlContactId: ids.ghlContactId,
      });
      return {
        duplicate: false,
        webhookId,
        status: "IGNORED",
        message: "No matching checkout",
      };
    }

    if (checkout) {
      await prisma.ghlWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          checkoutId: checkout.id,
          loanAiUserId: checkout.loanAiUserId,
        },
      });
    }

    let result;
    if (lifecycle === "failed") {
      if (!checkout) {
        await prisma.ghlWebhookEvent.update({
          where: { id: eventRow.id },
          data: {
            status: "IGNORED",
            processedAt: new Date(),
            errorMessage: "Payment failed but no checkout matched",
          },
        });
        return {
          duplicate: false,
          webhookId,
          status: "IGNORED",
          message: "No matching checkout for failure",
        };
      }
      result = await handleGhlPaymentFailure(
        prisma,
        checkout,
        `${eventType} reported payment failure`,
      );
    } else if (lifecycle === "cancelled") {
      result = await handleGhlSubscriptionCancelled(prisma, { checkout, ids });
    } else if (lifecycle === "expired") {
      result = await handleGhlSubscriptionExpired(prisma, { checkout, ids });
    } else if (lifecycle === "past_due") {
      result = await handleGhlSubscriptionPastDue(prisma, { checkout, ids });
    } else if (lifecycle === "paid") {
      result = await handleGhlPaymentSuccess(prisma, io, checkout, {
        ghlContactId: ids.ghlContactId,
        ghlInvoiceId: ids.ghlInvoiceId,
        ghlSubscriptionId: ids.ghlSubscriptionId,
        ghlPriceId: ids.ghlPriceId,
        ghlProductId: ids.ghlProductId,
        ghlTransactionId: ids.ghlTransactionId,
        phone: ids.phone,
      });
    } else {
      await prisma.ghlWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "IGNORED",
          processedAt: new Date(),
          errorMessage: `Unhandled lifecycle for event: ${eventType}`,
        },
      });
      return {
        duplicate: false,
        webhookId,
        status: "IGNORED",
        message: `Event ${eventType} not mapped to a lifecycle action`,
        checkoutId: checkout?.id || null,
      };
    }

    await prisma.ghlWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        checkoutId: result.checkoutId || checkout?.id || null,
        loanAiUserId: result.loanAiUserId || checkout?.loanAiUserId || null,
      },
    });

    logWebhookProcessed({
      webhookId,
      eventType,
      lifecycle,
      action: result.action,
      checkoutId: result.checkoutId || checkout?.id || null,
      loanAiUserId: result.loanAiUserId || checkout?.loanAiUserId || null,
      packageId: checkout?.packageId || null,
      billingPeriod: checkout?.billingCycle || null,
      ghlContactId: ids.ghlContactId || checkout?.ghlContactId || null,
      ghlPriceId: ids.ghlPriceId || checkout?.ghlPriceId || null,
      ghlInvoiceId: ids.ghlInvoiceId || checkout?.ghlInvoiceId || null,
      ghlSubscriptionId:
        ids.ghlSubscriptionId || checkout?.ghlSubscriptionId || null,
      organizationSubscriptionId: result.organizationSubscriptionId || null,
      paymentStatus: checkout?.paymentStatus || null,
      status: "PROCESSED",
    });

    return {
      duplicate: false,
      webhookId,
      status: "PROCESSED",
      action: result.action,
      checkoutId: result.checkoutId || checkout?.id || null,
      organizationSubscriptionId: result.organizationSubscriptionId || null,
    };
  } catch (err) {
    const message = String(err.message || "Webhook processing failed").slice(
      0,
      1000,
    );
    await prisma.ghlWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date(),
      },
    });
    logWebhookFailed({
      webhookId,
      eventType,
      lifecycle,
      message,
      ghlContactId: ids.ghlContactId,
      ghlInvoiceId: ids.ghlInvoiceId,
      ghlSubscriptionId: ids.ghlSubscriptionId,
    });
    err.loggedAsWebhookFailure = true;
    throw err;
  }
}

module.exports = {
  processGhlWebhook,
  extractIds,
  normalizeEventType,
  resolveWebhookId,
  sanitizePayloadSummary,
  classifyLifecycle,
  PAID_EVENT_TYPES,
  FAILED_EVENT_TYPES,
  CANCELLED_EVENT_TYPES,
  EXPIRED_EVENT_TYPES,
  PAST_DUE_EVENT_TYPES,
};
