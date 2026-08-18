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

describe("GHL webhook extractIds payload compatibility", () => {
  let restoreEnv;
  let unstub;
  let extractIds;
  let processGhlWebhook;

  beforeEach(() => {
    restoreEnv = applyPaymentEnv();
    unstub = stubFulfillSuccess();
    ({ extractIds, processGhlWebhook } = reload(
      "../../services/ghl/ghlWebhookProcessor",
    ));
  });

  afterEach(() => {
    unstub();
    restoreEnv();
  });

  it("1. extracts nested InvoicePaid payload (existing shape)", () => {
    const ids = extractIds({
      type: "InvoicePaid",
      webhookId: "wh_nested",
      invoice: {
        _id: "inv_nested_1",
        status: "paid",
        items: [{ priceId: "price_nested", productId: "prod_nested" }],
      },
      contact: {
        id: "contact_nested",
        email: "nested@example.com",
      },
    });

    assert.equal(ids.ghlInvoiceId, "inv_nested_1");
    assert.equal(ids.ghlContactId, "contact_nested");
    assert.equal(ids.email, "nested@example.com");
    assert.equal(ids.ghlPriceId, "price_nested");
    assert.equal(ids.ghlProductId, "prod_nested");
    assert.equal(ids.status, "paid");
  });

  it("2. extracts official root-level InvoicePaid payload", () => {
    const ids = extractIds({
      type: "InvoicePaid",
      webhookId: "wh_root",
      _id: "6a7adb288dea51cf4828594f",
      status: "paid",
      contactDetails: {
        id: "JCgeDFGyF2dTWqblxLy5",
        email: "tusharjain651@gmail.com",
      },
      invoiceItems: [
        {
          priceId: "price_root",
          productId: "prod_root",
        },
      ],
    });

    assert.equal(ids.ghlInvoiceId, "6a7adb288dea51cf4828594f");
    assert.equal(ids.ghlContactId, "JCgeDFGyF2dTWqblxLy5");
    assert.equal(ids.email, "tusharjain651@gmail.com");
    assert.equal(ids.ghlPriceId, "price_root");
    assert.equal(ids.ghlProductId, "prod_root");
    assert.equal(ids.status, "paid");
  });

  it("3. missing invoice ID leaves ghlInvoiceId null", () => {
    const ids = extractIds({
      type: "InvoicePaid",
      webhookId: "wh_no_invoice",
      status: "paid",
      contactDetails: {
        id: "contact_only",
        email: "only@example.com",
      },
    });

    assert.equal(ids.ghlInvoiceId, null);
    assert.equal(ids.ghlContactId, "contact_only");
    assert.equal(ids.email, "only@example.com");
  });

  it("4. missing contact still extracts invoice and line items", () => {
    const ids = extractIds({
      type: "InvoicePaid",
      webhookId: "wh_no_contact",
      _id: "inv_no_contact",
      status: "paid",
      invoiceItems: [{ priceId: "price_x", productId: "prod_x" }],
    });

    assert.equal(ids.ghlInvoiceId, "inv_no_contact");
    assert.equal(ids.ghlContactId, null);
    assert.equal(ids.email, null);
    assert.equal(ids.ghlPriceId, "price_x");
    assert.equal(ids.ghlProductId, "prod_x");
  });

  it("5. duplicate webhook returns duplicate without reprocessing", async () => {
    const prisma = {
      ghlWebhookEvent: {
        create: async () => {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        },
        findUnique: async () => ({
          webhookId: "wh_dup_extract",
          status: "PROCESSED",
        }),
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "InvoicePaid",
      webhookId: "wh_dup_extract",
      _id: "6a7adb288dea51cf4828594f",
      status: "paid",
      contactDetails: { id: "JCgeDFGyF2dTWqblxLy5" },
    });

    assert.equal(result.duplicate, true);
    assert.equal(result.webhookId, "wh_dup_extract");
    assert.equal(result.status, "PROCESSED");
  });

  it("6. successful checkout lookup by ghlInvoiceId from root payload", async () => {
    const checkout = {
      id: "8108ff0b-a9d5-4a9d-b517-b8c64fa8980a",
      loanAiUserId: "15daae66-7b15-4bb1-8ebd-3c9297021e61",
      packageId: "pkg_basic",
      billingCycle: "MONTHLY",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      ghlContactId: "JCgeDFGyF2dTWqblxLy5",
      ghlInvoiceId: "6a7adb288dea51cf4828594f",
      ghlPriceId: "price_basic_monthly",
      ghlSubscriptionId: null,
      organizationSubscriptionId: null,
    };

    const findFirstCalls = [];
    const prisma = {
      ghlWebhookEvent: {
        create: async ({ data }) => ({ id: "evt_root", ...data }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      loanAiGhlCheckout: {
        findUnique: async () => null,
        findFirst: async (args) => {
          findFirstCalls.push(args);
          if (args?.where?.ghlInvoiceId === "6a7adb288dea51cf4828594f") {
            return checkout;
          }
          return null;
        },
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "InvoicePaid",
      webhookId: "wh_lookup_invoice",
      _id: "6a7adb288dea51cf4828594f",
      status: "paid",
      contactDetails: {
        id: "JCgeDFGyF2dTWqblxLy5",
        email: "tusharjain651@gmail.com",
      },
      invoiceItems: [{ priceId: "price_root", productId: "prod_root" }],
    });

    assert.ok(
      findFirstCalls.some(
        (c) => c?.where?.ghlInvoiceId === "6a7adb288dea51cf4828594f",
      ),
      "expected checkout lookup by ghlInvoiceId",
    );
    assert.equal(result.duplicate, false);
    assert.equal(result.status, "PROCESSED");
    assert.equal(result.action, "payment_success");
    assert.equal(result.checkoutId, checkout.id);
    assert.equal(result.organizationSubscriptionId, "org_sub_1");
  });

  it("prefers nested invoice._id over root _id when both present", () => {
    const ids = extractIds({
      type: "InvoicePaid",
      _id: "root_should_lose",
      invoice: { _id: "nested_wins", status: "paid" },
      contact: { id: "c1", email: "a@b.com" },
      contactDetails: { id: "c_root", email: "root@b.com" },
    });

    assert.equal(ids.ghlInvoiceId, "nested_wins");
    assert.equal(ids.ghlContactId, "c1");
    assert.equal(ids.email, "a@b.com");
  });

  it("paid webhook with no matching checkout is IGNORED", async () => {
    const prisma = {
      ghlWebhookEvent: {
        create: async ({ data }) => ({ id: "evt_ignore", ...data }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      loanAiGhlCheckout: {
        findUnique: async () => null,
        findFirst: async () => null,
      },
      loanAiUser: {
        findFirst: async () => null,
      },
    };

    const result = await processGhlWebhook(prisma, null, {
      type: "InvoicePaid",
      webhookId: "wh_no_match",
      status: "paid",
      contactDetails: { id: "unknown_contact" },
    });

    assert.equal(result.status, "IGNORED");
    assert.equal(result.message, "No matching checkout");
  });
});

const GHL_WORKFLOW_WEBHOOK_PAYLOAD = {
  webhookId: "wh_workflow_invoice_paid",
  customData: {
    type: "InvoicePaid",
    status: "paid",
  },
  invoice: {
    _id: "6a82c6909418c7ce622f5bd2",
    _data: {},
  },
  contact_id: "JCgeDFGyF2dTWqblxLy5",
  email: "customer@example.com",
};

describe("GHL Workflow Webhook payload (customData + contact_id)", () => {
  let restoreEnv;
  let unstub;
  let extractIds;
  let normalizeEventType;
  let classifyLifecycle;
  let processGhlWebhook;

  beforeEach(() => {
    restoreEnv = applyPaymentEnv();
    unstub = stubFulfillSuccess();
    ({ extractIds, normalizeEventType, classifyLifecycle, processGhlWebhook } =
      reload("../../services/ghl/ghlWebhookProcessor"));
  });

  afterEach(() => {
    unstub();
    restoreEnv();
  });

  it("1. customData.type = InvoicePaid → event type InvoicePaid", () => {
    assert.equal(
      normalizeEventType(GHL_WORKFLOW_WEBHOOK_PAYLOAD),
      "InvoicePaid",
    );
  });

  it("2. customData.status = paid → lifecycle paid", () => {
    const ids = extractIds(GHL_WORKFLOW_WEBHOOK_PAYLOAD);
    assert.equal(ids.status, "paid");
    assert.equal(
      classifyLifecycle({
        eventType: normalizeEventType(GHL_WORKFLOW_WEBHOOK_PAYLOAD),
        status: ids.status,
      }),
      "paid",
    );
  });

  it("3. contact_id → ghlContactId", () => {
    const ids = extractIds(GHL_WORKFLOW_WEBHOOK_PAYLOAD);
    assert.equal(ids.ghlContactId, "JCgeDFGyF2dTWqblxLy5");
  });

  it("4. invoice._id → ghlInvoiceId", () => {
    const ids = extractIds(GHL_WORKFLOW_WEBHOOK_PAYLOAD);
    assert.equal(ids.ghlInvoiceId, "6a82c6909418c7ce622f5bd2");
  });

  it("5. email → email", () => {
    const ids = extractIds(GHL_WORKFLOW_WEBHOOK_PAYLOAD);
    assert.equal(ids.email, "customer@example.com");
  });

  it("6. complete workflow payload reaches paid fulfillment branch", async () => {
    const checkout = {
      id: "052fa041-545c-4f22-9427-d6d101951e77",
      loanAiUserId: "15daae66-7b15-4bb1-8ebd-3c9297021e61",
      packageId: "pkg_basic",
      billingCycle: "MONTHLY",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      ghlContactId: "JCgeDFGyF2dTWqblxLy5",
      ghlInvoiceId: "6a82c6909418c7ce622f5bd2",
      ghlPriceId: "price_basic_monthly",
      ghlSubscriptionId: null,
      organizationSubscriptionId: null,
    };

    const prisma = {
      ghlWebhookEvent: {
        create: async ({ data }) => ({ id: "evt_workflow", ...data }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      loanAiGhlCheckout: {
        findUnique: async () => null,
        findFirst: async (args) => {
          if (args?.where?.ghlInvoiceId === checkout.ghlInvoiceId) {
            return checkout;
          }
          return null;
        },
      },
    };

    const result = await processGhlWebhook(
      prisma,
      null,
      GHL_WORKFLOW_WEBHOOK_PAYLOAD,
    );

    assert.equal(result.duplicate, false);
    assert.equal(result.status, "PROCESSED");
    assert.equal(result.action, "payment_success");
    assert.equal(result.checkoutId, checkout.id);
    assert.equal(result.organizationSubscriptionId, "org_sub_1");
  });
});
