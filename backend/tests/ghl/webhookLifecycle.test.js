const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, clearModule, reload } = require("./helpers");

function stubFulfillSuccess() {
  const fulfill = require("../../services/ghl/fulfillGhlCheckout");
  const original = {
    fulfillPaidGhlCheckout: fulfill.fulfillPaidGhlCheckout,
    markCheckoutPaymentFailed: fulfill.markCheckoutPaymentFailed,
  };
  fulfill.fulfillPaidGhlCheckout = async (_prisma, _io, checkout) => ({
    alreadyProcessed: false,
    checkoutId: checkout.id,
    organizationSubscriptionId: "org_sub_1",
    loanAiUserId: checkout.loanAiUserId,
    provisioned: true,
  });
  fulfill.markCheckoutPaymentFailed = async (prisma, checkout, reason) =>
    prisma.loanAiGhlCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
        lastError: reason,
      },
    });

  clearModule("../../services/ghl/ghlSubscriptionLifecycle");
  clearModule("../../services/ghl/ghlWebhookProcessor");
  return () => {
    fulfill.fulfillPaidGhlCheckout = original.fulfillPaidGhlCheckout;
    fulfill.markCheckoutPaymentFailed = original.markCheckoutPaymentFailed;
    clearModule("../../services/ghl/ghlSubscriptionLifecycle");
    clearModule("../../services/ghl/ghlWebhookProcessor");
  };
}

function makeCheckout(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    loanAiUserId: "user_1",
    packageId: "pkg_basic",
    billingCycle: "MONTHLY",
    status: "CHECKOUT_CREATED",
    paymentStatus: "PENDING",
    ghlContactId: "contact_1",
    ghlInvoiceId: "inv_1",
    ghlPriceId: "price_basic_monthly",
    ghlSubscriptionId: null,
    organizationSubscriptionId: null,
    checkoutUrl: "https://pay.example/checkout",
    ...overrides,
  };
}

describe("Webhook + lifecycle scenarios (12–16)", () => {
  let restoreEnv;
  let unstub;
  let processGhlWebhook;
  let classifyLifecycle;
  let handleGhlPaymentFailure;
  let handleGhlSubscriptionCancelled;
  let handleGhlSubscriptionPastDue;

  beforeEach(() => {
    restoreEnv = applyPaymentEnv();
    unstub = stubFulfillSuccess();
    ({
      processGhlWebhook,
      classifyLifecycle,
    } = reload("../../services/ghl/ghlWebhookProcessor"));
    ({
      handleGhlPaymentFailure,
      handleGhlSubscriptionCancelled,
      handleGhlSubscriptionPastDue,
    } = reload("../../services/ghl/ghlSubscriptionLifecycle"));
  });

  afterEach(() => {
    unstub();
    restoreEnv();
  });

  it("classifies paid / failed / cancelled / past_due events", () => {
    assert.equal(
      classifyLifecycle({ eventType: "InvoicePaid", status: null }),
      "paid",
    );
    assert.equal(
      classifyLifecycle({ eventType: "PaymentFailed", status: null }),
      "failed",
    );
    assert.equal(
      classifyLifecycle({
        eventType: "subscription.cancelled",
        status: null,
      }),
      "cancelled",
    );
    assert.equal(
      classifyLifecycle({
        eventType: "subscription.past_due",
        status: null,
      }),
      "past_due",
    );
  });

  it("12. Successful payment webhook", async () => {
    const checkout = makeCheckout();
    const updates = [];
    const prisma = {
      ghlWebhookEvent: {
        create: async ({ data }) => ({ id: "evt_1", ...data }),
        update: async ({ where, data }) => {
          updates.push({ where, data });
          return { id: where.id, ...data };
        },
      },
      loanAiGhlCheckout: {
        findFirst: async () => checkout,
        findUnique: async () => checkout,
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "InvoicePaid",
      webhookId: "wh_paid_1",
      invoice: { _id: "inv_1", status: "paid" },
      contact: { id: "contact_1" },
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.status, "PROCESSED");
    assert.equal(result.action, "payment_success");
    assert.equal(result.organizationSubscriptionId, "org_sub_1");
    assert.ok(updates.some((u) => u.data.status === "PROCESSED"));
  });

  it("13. Failed payment webhook", async () => {
    const checkout = makeCheckout();
    let failedUpdate = null;
    const prisma = {
      ghlWebhookEvent: {
        create: async ({ data }) => ({ id: "evt_fail", ...data }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      loanAiGhlCheckout: {
        findFirst: async () => checkout,
        findUnique: async () => checkout,
        update: async ({ where, data }) => {
          failedUpdate = { where, data };
          return { id: where.id, ...data };
        },
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "PaymentFailed",
      webhookId: "wh_fail_1",
      invoice: { _id: "inv_1", status: "failed" },
      contact: { id: "contact_1" },
    });

    assert.equal(result.action, "payment_failed");
    assert.equal(result.status, "PROCESSED");
    assert.equal(failedUpdate.data.paymentStatus, "FAILED");

    // Direct handler also covers failure without webhook wrapper
    const direct = await handleGhlPaymentFailure(
      prisma,
      checkout,
      "card declined",
    );
    assert.equal(direct.action, "payment_failed");
  });

  it("14. Cancelled subscription webhook", async () => {
    const checkout = makeCheckout({
      status: "PAID",
      paymentStatus: "PAID",
      organizationSubscriptionId: "org_sub_1",
      ghlSubscriptionId: "gsub_1",
    });
    const orgSub = {
      id: "org_sub_1",
      organizationId: "org_1",
      status: "ACTIVE",
      ghlSubscriptionId: "gsub_1",
      ghlContactId: "contact_1",
    };

    const billing = require("../../services/subscription/subscriptionBilling");
    const originalCancel = billing.cancelSubscription;
    billing.cancelSubscription = async () => ({
      ...orgSub,
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    clearModule("../../services/ghl/ghlSubscriptionLifecycle");
    ({ handleGhlSubscriptionCancelled } = reload(
      "../../services/ghl/ghlSubscriptionLifecycle",
    ));

    try {
      const prisma = {
        organizationSubscription: {
          findUnique: async () => orgSub,
          findFirst: async () => orgSub,
          update: async ({ data }) => ({ ...orgSub, ...data }),
        },
        loanAiGhlCheckout: {
          update: async ({ data }) => ({ ...checkout, ...data }),
        },
      };

      const result = await handleGhlSubscriptionCancelled(prisma, {
        checkout,
        ids: { ghlSubscriptionId: "gsub_1", ghlContactId: "contact_1" },
      });
      assert.equal(result.action, "subscription_cancelled");
      assert.equal(result.found, true);
      assert.equal(result.organizationSubscriptionId, "org_sub_1");
    } finally {
      billing.cancelSubscription = originalCancel;
      clearModule("../../services/ghl/ghlSubscriptionLifecycle");
    }
  });

  it("15. Past-due subscription webhook", async () => {
    const checkout = makeCheckout({
      status: "PAID",
      paymentStatus: "PAID",
      organizationSubscriptionId: "org_sub_1",
    });
    const orgSub = {
      id: "org_sub_1",
      organizationId: "org_1",
      status: "ACTIVE",
      ghlSubscriptionId: "gsub_1",
      ghlContactId: "contact_1",
    };
    let updatedStatus = null;
    const prisma = {
      organizationSubscription: {
        findUnique: async () => orgSub,
        findFirst: async () => orgSub,
        update: async ({ data }) => {
          updatedStatus = data.status;
          return { ...orgSub, ...data };
        },
      },
      subscriptionInvoice: {
        updateMany: async () => ({ count: 0 }),
      },
      loanAiGhlCheckout: {
        update: async ({ data }) => ({ ...checkout, ...data }),
      },
    };

    const result = await handleGhlSubscriptionPastDue(prisma, {
      checkout,
      ids: { ghlSubscriptionId: "gsub_1", ghlInvoiceId: "inv_1" },
    });
    assert.equal(result.action, "subscription_past_due");
    assert.equal(updatedStatus, "PAST_DUE");
  });

  it("16. Duplicate webhook", async () => {
    const prisma = {
      ghlWebhookEvent: {
        create: async () => {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        },
        findUnique: async () => ({
          webhookId: "wh_dup_1",
          status: "PROCESSED",
        }),
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "InvoicePaid",
      webhookId: "wh_dup_1",
      invoice: { _id: "inv_1" },
    });

    assert.equal(result.duplicate, true);
    assert.equal(result.webhookId, "wh_dup_1");
    assert.equal(result.status, "PROCESSED");
  });
});
