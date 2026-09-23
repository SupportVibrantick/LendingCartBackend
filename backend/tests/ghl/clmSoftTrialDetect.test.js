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

  it("ignores unrelated paid events", () => {
    process.env.CLM_GHL_SOFT_TRIAL_ENABLED = "true";
    delete process.env.CLM_GHL_PRODUCT_ID;
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
