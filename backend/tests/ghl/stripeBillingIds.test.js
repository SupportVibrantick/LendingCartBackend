const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("stripeBilling helpers", () => {
  it("detects Stripe subscription and customer ids", () => {
    const {
      looksLikeStripeSubscriptionId,
      looksLikeStripeCustomerId,
      extractStripeIdsFromPayload,
    } = require("../../services/stripe/stripeBilling");

    assert.equal(looksLikeStripeSubscriptionId("sub_123ABC"), true);
    assert.equal(looksLikeStripeSubscriptionId("ghl-sub-1"), false);
    assert.equal(looksLikeStripeCustomerId("cus_99"), true);
    assert.equal(looksLikeStripeCustomerId("contact_1"), false);

    const extracted = extractStripeIdsFromPayload({
      subscription: { id: "sub_FromNested", customer: "cus_FromNested" },
    });
    assert.equal(extracted.stripeSubscriptionId, "sub_FromNested");
    assert.equal(extracted.stripeCustomerId, "cus_FromNested");
  });
});
