/**
 * Unit tests: Agency plan resolution from package + GHL add-ons.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveAgencyPlanFromEntitlements,
  isGhlAgencyEligible,
} = require("../../services/ghl/ghlAccountLocation.service");

describe("resolveAgencyPlanFromEntitlements", () => {
  it("maps base Pro/Elite packages", () => {
    assert.equal(resolveAgencyPlanFromEntitlements("PRO"), "PRO");
    assert.equal(resolveAgencyPlanFromEntitlements("ELITE"), "ELITE");
    assert.equal(resolveAgencyPlanFromEntitlements("BASIC"), null);
  });

  it("unlocks PRO tier via GHL_STARTER add-on on Starter", () => {
    assert.equal(
      resolveAgencyPlanFromEntitlements("BASIC", [{ code: "GHL_STARTER" }]),
      "PRO",
    );
    assert.equal(
      isGhlAgencyEligible("BASIC", ["GHL_STARTER"]),
      true,
    );
  });

  it("unlocks ELITE tier via Growth add-on", () => {
    assert.equal(
      resolveAgencyPlanFromEntitlements("BASIC", [{ code: "GHL_BASIC_SYNC" }]),
      "ELITE",
    );
    assert.equal(
      resolveAgencyPlanFromEntitlements("PRO", [{ code: "GHL_GROWTH" }]),
      "ELITE",
    );
  });

  it("Growth add-on wins over Starter add-on", () => {
    assert.equal(
      resolveAgencyPlanFromEntitlements("BASIC", [
        { code: "GHL_STARTER" },
        { code: "GHL_BASIC_SYNC" },
      ]),
      "ELITE",
    );
  });

  it("ignores unrelated add-ons on BASIC", () => {
    assert.equal(
      resolveAgencyPlanFromEntitlements("BASIC", [{ code: "WHITE_LABEL" }]),
      null,
    );
    assert.equal(isGhlAgencyEligible("BASIC", [{ code: "CRE_PACK" }]), false);
  });
});
