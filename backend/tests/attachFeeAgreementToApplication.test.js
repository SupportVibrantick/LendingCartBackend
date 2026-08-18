const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseOptionalFeeAgreementInput,
  getFeeAgreementRequestError,
} = require("../services/feeAgreement/attachFeeAgreementToApplication");

describe("parseOptionalFeeAgreementInput", () => {
  it("skips when include is not true", () => {
    assert.deepEqual(parseOptionalFeeAgreementInput({}), {
      include: false,
      terms: null,
      errors: [],
    });
    assert.deepEqual(
      parseOptionalFeeAgreementInput({ feeAgreement: { include: false } }),
      { include: false, terms: null, errors: [] },
    );
    assert.equal(getFeeAgreementRequestError({}), null);
  });

  it("requires all terms when include is true", () => {
    const parsed = parseOptionalFeeAgreementInput({
      feeAgreement: { include: true },
    });
    assert.equal(parsed.include, true);
    assert.ok(parsed.errors.some((error) => /broker fee/i.test(error)));
    assert.ok(parsed.errors.some((error) => /upfront fee/i.test(error)));
    assert.ok(parsed.errors.some((error) => /exclusivity/i.test(error)));
    assert.equal(
      getFeeAgreementRequestError({ feeAgreement: { include: true } }),
      parsed.errors[0],
    );
  });

  it("rejects blank strings instead of treating them as zero", () => {
    const parsed = parseOptionalFeeAgreementInput({
      feeAgreement: {
        include: true,
        brokerPoints: " ",
        upfrontFee: "",
        exclusivityMonths: "",
      },
    });
    assert.ok(parsed.errors.length >= 3);
  });

  it("accepts valid terms", () => {
    const parsed = parseOptionalFeeAgreementInput({
      feeAgreement: {
        include: true,
        brokerPoints: 1.5,
        upfrontFee: 2500,
        exclusivityMonths: 6,
      },
    });
    assert.equal(parsed.include, true);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.terms.brokerPoints, 1.5);
    assert.equal(parsed.terms.upfrontFee, 2500);
    assert.equal(parsed.terms.exclusivityMonths, 6);
    assert.equal(
      getFeeAgreementRequestError({
        feeAgreement: {
          include: true,
          brokerPoints: 1.5,
          upfrontFee: 2500,
          exclusivityMonths: 6,
        },
      }),
      null,
    );
  });
});
