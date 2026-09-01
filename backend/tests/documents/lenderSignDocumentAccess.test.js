const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildLenderSignDocumentWhere,
  buildLenderSignDocumentVisibilityFilter,
} = require("../../utils/documents/lenderSignDocumentAccess");

test("buildLenderSignDocumentVisibilityFilter includes forwarded broker uploads", () => {
  const filter = buildLenderSignDocumentVisibilityFilter("lender-app-1");

  assert.equal(filter.OR.length, 2);
  assert.deepEqual(filter.OR[0], {
    requestApplicationLenderId: "lender-app-1",
  });
  assert.equal(filter.OR[1].signStatus.in.length, 2);
  assert.equal(
    filter.OR[1].uploads.some.documentSubmissions.some.applicationLenderId,
    "lender-app-1",
  );
});

test("buildLenderSignDocumentWhere scopes to loan and visibility", () => {
  const where = buildLenderSignDocumentWhere(
    { loanApplicationId: "loan-1" },
    "lender-app-1",
    "",
  );

  assert.equal(where.loanApplicationId, "loan-1");
  assert.equal(where.requiresClientSignature, true);
  assert.equal(where.AND.length, 1);
  assert.equal(where.AND[0].OR[0].requestApplicationLenderId, "lender-app-1");
});

test("buildLenderSignDocumentWhere adds search without breaking visibility", () => {
  const where = buildLenderSignDocumentWhere(
    { loanApplicationId: "loan-1" },
    "lender-app-1",
    "sba",
  );

  assert.equal(where.AND.length, 2);
  assert.ok(where.AND[1].OR);
});
