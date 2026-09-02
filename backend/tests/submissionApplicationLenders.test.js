const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APPLICATION_LENDER_SUBMISSION_INCLUDE,
  formatSubmissionApplicationLenders,
} = require("../utils/applications/submissionApplicationLenders");

test("APPLICATION_LENDER_SUBMISSION_INCLUDE reads product name via loanProduct", () => {
  assert.equal(
    APPLICATION_LENDER_SUBMISSION_INCLUDE.lenderProduct.select.loanProductCode,
    true,
  );
  assert.deepEqual(
    APPLICATION_LENDER_SUBMISSION_INCLUDE.lenderProduct.select.loanProduct
      .select,
    { id: true, name: true, code: true },
  );
  assert.equal(
    "name" in APPLICATION_LENDER_SUBMISSION_INCLUDE.lenderProduct.select,
    false,
  );
});

test("formatSubmissionApplicationLenders maps lender product fields", () => {
  const lenders = formatSubmissionApplicationLenders(
    [
      {
        id: "al-1",
        lenderOrgId: "org-1",
        lenderProductId: "lp-1",
        status: "APPROVED",
        sentAt: new Date("2026-01-01"),
        lastUpdatedAt: new Date("2026-01-02"),
        lender: {
          name: "Test Lender",
          users: [{ profileImage: "/img.png" }],
        },
        lenderProduct: {
          id: "lp-1",
          loanProductCode: "SBA_7A",
          loanProduct: { id: "prod-1", name: "SBA 7(a)", code: "SBA_7A" },
        },
        lenderReviews: [],
      },
    ],
    { fundedApplicationLenderId: "al-1" },
  );

  assert.equal(lenders.length, 1);
  assert.equal(lenders[0].loanProductName, "SBA 7(a)");
  assert.equal(lenders[0].loanProductCode, "SBA_7A");
  assert.equal(lenders[0].isFundedLender, true);
});
