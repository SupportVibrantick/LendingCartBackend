const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  expandLoanProductAliasCodes,
  resolveCanonicalLoanProductCode,
} = require("../utils/loanProducts/loanProductAliases");

describe("loanProductAliases", () => {
  it("keeps Bridge residential and CRE codes distinct", () => {
    assert.deepEqual(expandLoanProductAliasCodes("BRIDGE_LOAN"), [
      "BRIDGE_LOAN",
    ]);
    assert.deepEqual(expandLoanProductAliasCodes("BRIDGE_LOAN_1_TO_4_UNITS"), [
      "BRIDGE_LOAN_1_TO_4_UNITS",
    ]);
  });

  it("keeps Construction residential and CRE codes distinct", () => {
    assert.deepEqual(expandLoanProductAliasCodes("CONSTRUCTION_LOAN"), [
      "CONSTRUCTION_LOAN",
    ]);
    assert.deepEqual(
      expandLoanProductAliasCodes("CONSTRUCTION_LOAN_1_TO_4_UNITS"),
      ["CONSTRUCTION_LOAN_1_TO_4_UNITS"],
    );
  });

  it("keeps Rental Portfolio residential and CRE codes distinct", () => {
    assert.deepEqual(expandLoanProductAliasCodes("RENTAL_PORTFOLIO"), [
      "RENTAL_PORTFOLIO",
    ]);
    assert.deepEqual(expandLoanProductAliasCodes("RENTAL_PORTFOLIO_CRE"), [
      "RENTAL_PORTFOLIO_CRE",
    ]);
  });

  it("returns the original code for other products", () => {
    assert.deepEqual(expandLoanProductAliasCodes("DSCR_LOAN_1_TO_4_UNITS"), [
      "DSCR_LOAN_1_TO_4_UNITS",
    ]);
  });

  it("does not canonicalize residential Bridge/Construction into CRE codes", () => {
    assert.equal(
      resolveCanonicalLoanProductCode("BRIDGE_LOAN_1_TO_4_UNITS"),
      "BRIDGE_LOAN_1_TO_4_UNITS",
    );
    assert.equal(
      resolveCanonicalLoanProductCode("CONSTRUCTION_LOAN_1_TO_4_UNITS"),
      "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    );
    assert.equal(resolveCanonicalLoanProductCode("BRIDGE_LOAN"), "BRIDGE_LOAN");
    assert.equal(
      resolveCanonicalLoanProductCode("RENTAL_PORTFOLIO_CRE"),
      "RENTAL_PORTFOLIO_CRE",
    );
  });

  it("handles empty input safely", () => {
    assert.deepEqual(expandLoanProductAliasCodes(""), []);
    assert.deepEqual(expandLoanProductAliasCodes(null), []);
    assert.equal(resolveCanonicalLoanProductCode(""), "");
  });
});
