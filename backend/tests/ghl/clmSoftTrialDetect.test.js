/**
 * Lightweight unit checks for CLM soft-trial detection (no DB).
 * Run: node --test tests/ghl/clmSoftTrialDetect.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("CLM soft trial detection", () => {
  it("matches customData.lendingCartAction", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        { customData: { lendingCartAction: "CLM_SOFT_TRIAL" } },
        { email: "a@b.com" },
      ),
      true,
    );
  });

  it("matches product name contains Commercial Lending Mastery", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        {
          items: [{ name: "Commercial Lending Mastery - Product", productId: "x" }],
        },
        { email: "a@b.com" },
      ),
      true,
    );
  });

  it("matches configured product id", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    process.env.CLM_GHL_PRODUCT_ID = "prod-clm-123";
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        { productId: "prod-clm-123" },
        { email: "a@b.com" },
      ),
      true,
    );
  });

  it("matches top-level lendingCartAction from GHL workflow custom data", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        {
          email: "buyer@example.com",
          lendingCartAction: "CLM_SOFT_TRIAL",
          first_name: "Tushar",
        },
        { email: "buyer@example.com" },
      ),
      true,
    );
  });

  it("matches product id case-insensitively", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    process.env.CLM_GHL_PRODUCT_ID = "6ab197d4a8217B273b6dacdf";
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        { productId: "6ab197d4a8217b273b6dacdf" },
        { email: "a@b.com" },
      ),
      true,
    );
  });

  it("matches GHL order-form workflow payload (order + workflow + email)", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete process.env.CLM_GHL_PRODUCT_ID;
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        {
          contact_id: "abc123",
          first_name: "Tushar",
          last_name: "Jain",
          email: "gavin.luian@forliion.com",
          company_name: "VIB",
          order: {
            id: "ord_1",
            amount: 9997,
            products: [
              {
                _id: "prod1",
                name: "Commercial Lending Mastery - Product",
              },
            ],
          },
          workflow: { id: "wf_1", name: "CLM Order Complete" },
          customData: {},
        },
        { email: "gavin.luian@forliion.com", ghlContactId: "abc123" },
      ),
      true,
    );
  });

  it("matches order amount 9997 even without product name", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    process.env.CLM_GHL_ORDER_AMOUNT = "9997";
    delete process.env.CLM_GHL_PRODUCT_ID;
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        { order: { amount: "9997.00" }, email: "a@b.com" },
        { email: "a@b.com" },
      ),
      true,
    );
  });

  it("ignores unrelated paid events", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete process.env.CLM_GHL_PRODUCT_ID;
    delete process.env.CLM_GHL_ORDER_AMOUNT;
    delete require.cache[require.resolve("../../services/ghl/fulfillClmGhlOrder")];
    const { isClmSoftTrialOrder } = require("../../services/ghl/fulfillClmGhlOrder");

    assert.equal(
      isClmSoftTrialOrder(
        { items: [{ name: "Some Other Product" }] },
        { email: "a@b.com" },
      ),
      false,
    );
  });
});

describe("soft trial without billing notes", () => {
  it("recognizes CLM and Loan AI notes", () => {
    const {
      isSoftTrialWithoutBilling,
      CLM_GHL_SOFT_TRIAL_NOTE,
      LOAN_AI_FREE_TRIAL_NOTE,
    } = require("../../services/subscription/freeTrial");

    assert.equal(isSoftTrialWithoutBilling(CLM_GHL_SOFT_TRIAL_NOTE), true);
    assert.equal(isSoftTrialWithoutBilling(LOAN_AI_FREE_TRIAL_NOTE), true);
    assert.equal(isSoftTrialWithoutBilling("admin assign"), false);
  });
});

describe("resolveWebhookId for workflow payloads", () => {
  it("does not collapse different CLM payloads into one hash", () => {
    delete require.cache[require.resolve("../../services/ghl/ghlWebhookProcessor")];
    const { resolveWebhookId } = require("../../services/ghl/ghlWebhookProcessor");

    const a = resolveWebhookId({
      lendingCartAction: "CLM_SOFT_TRIAL",
      email: "a@example.com",
    });
    const b = resolveWebhookId({
      lendingCartAction: "CLM_SOFT_TRIAL",
      email: "b@example.com",
    });
    const emptyish = resolveWebhookId({ type: "Unknown" });

    assert.match(a, /^hash:[a-f0-9]{40}$/);
    assert.notEqual(a, b);
    assert.notEqual(a, emptyish);
  });
});
