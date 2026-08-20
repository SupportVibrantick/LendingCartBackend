const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  expandLoanProductAliasCodes,
  resolveCanonicalLoanProductCode,
} = require("../utils/loanProducts/loanProductAliases");

describe("loanProductAliases", () => {
  it("expands Bridge codes in both directions", () => {
    assert.deepEqual(expandLoanProductAliasCodes("BRIDGE_LOAN"), [
      "BRIDGE_LOAN",
      "BRIDGE_LOAN_1_TO_4_UNITS",
    ]);
    assert.deepEqual(expandLoanProductAliasCodes("BRIDGE_LOAN_1_TO_4_UNITS"), [
      "BRIDGE_LOAN",
      "BRIDGE_LOAN_1_TO_4_UNITS",
    ]);
  });

  it("expands Construction codes in both directions", () => {
    assert.deepEqual(expandLoanProductAliasCodes("CONSTRUCTION_LOAN"), [
      "CONSTRUCTION_LOAN",
      "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    ]);
    assert.deepEqual(
      expandLoanProductAliasCodes("CONSTRUCTION_LOAN_1_TO_4_UNITS"),
      ["CONSTRUCTION_LOAN", "CONSTRUCTION_LOAN_1_TO_4_UNITS"],
    );
  });

  it("returns the original code for non-aliased products", () => {
    assert.deepEqual(expandLoanProductAliasCodes("DSCR_LOAN_1_TO_4_UNITS"), [
      "DSCR_LOAN_1_TO_4_UNITS",
    ]);
  });

  it("canonicalizes residential Bridge/Construction to shared codes", () => {
    assert.equal(
      resolveCanonicalLoanProductCode("BRIDGE_LOAN_1_TO_4_UNITS"),
      "BRIDGE_LOAN",
    );
    assert.equal(
      resolveCanonicalLoanProductCode("CONSTRUCTION_LOAN_1_TO_4_UNITS"),
      "CONSTRUCTION_LOAN",
    );
    assert.equal(resolveCanonicalLoanProductCode("BRIDGE_LOAN"), "BRIDGE_LOAN");
    assert.equal(
      resolveCanonicalLoanProductCode("DSCR_LOAN_1_TO_4_UNITS"),
      "DSCR_LOAN_1_TO_4_UNITS",
    );
  });

  it("handles empty input safely", () => {
    assert.deepEqual(expandLoanProductAliasCodes(""), []);
    assert.deepEqual(expandLoanProductAliasCodes(null), []);
    assert.equal(resolveCanonicalLoanProductCode(""), "");
  });
});
