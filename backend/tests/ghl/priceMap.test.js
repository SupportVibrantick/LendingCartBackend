const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload } = require("./helpers");

describe("GHL price map — plan × billing checkouts (1–6, 8–10)", () => {
  let restore;
  let resolveGhlPriceId;
  let CHECKOUT_ERROR_CODES;

  beforeEach(() => {
    restore = applyPaymentEnv();
    ({ resolveGhlPriceId } = reload("../../services/ghl/ghlPriceMap"));
    ({ CHECKOUT_ERROR_CODES } = reload("../../services/ghl/ghlCheckoutErrors"));
  });

  afterEach(() => {
    restore();
  });

  const cases = [
    ["BASIC", "MONTHLY", "price_basic_monthly", "1. Basic Monthly"],
    ["BASIC", "YEARLY", "price_basic_yearly", "2. Basic Yearly"],
    ["PRO", "MONTHLY", "price_pro_monthly", "3. Pro Monthly"],
    ["PRO", "YEARLY", "price_pro_yearly", "4. Pro Yearly"],
    ["ELITE", "MONTHLY", "price_elite_monthly", "5. Elite Monthly"],
    ["ELITE", "YEARLY", "price_elite_yearly", "6. Elite Yearly"],
  ];

  for (const [code, cycle, priceId, label] of cases) {
    it(label, () => {
      const resolved = resolveGhlPriceId(code, cycle);
      assert.equal(resolved.packageCode, code);
      assert.equal(resolved.billingCycle, cycle);
      assert.equal(resolved.priceId, priceId);
      assert.ok(resolved.envKey.includes(code));
    });
  }

  it("8. Invalid package", () => {
    assert.throws(
      () => resolveGhlPriceId("STARTER", "MONTHLY"),
      (err) =>
        err.code === CHECKOUT_ERROR_CODES.INVALID_PACKAGE &&
        err.statusCode === 400,
    );
  });

  it("9. Invalid billing period", () => {
    assert.throws(
      () => resolveGhlPriceId("BASIC", "WEEKLY"),
      (err) =>
        err.code === CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD &&
        err.statusCode === 400,
    );
  });

  it("10. Missing GHL price ID", () => {
    restore();
    restore = applyPaymentEnv({ GHL_PRO_MONTHLY_PRICE_ID: "" });
    ({ resolveGhlPriceId } = reload("../../services/ghl/ghlPriceMap"));
    ({ CHECKOUT_ERROR_CODES } = reload("../../services/ghl/ghlCheckoutErrors"));

    assert.throws(
      () => resolveGhlPriceId("PRO", "MONTHLY"),
      (err) =>
        err.code === CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE &&
        err.statusCode === 503,
    );
  });
});
