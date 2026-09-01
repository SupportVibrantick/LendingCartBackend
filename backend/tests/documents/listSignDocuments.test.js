const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildBrokerSignDocumentWhere,
  appendSignDocumentSearch,
} = require("../../utils/documents/listSignDocuments");

test("buildBrokerSignDocumentWhere applies lender filter", () => {
  const where = buildBrokerSignDocumentWhere("loan-1", {
    lenderId: "lender-app-1",
    searchTerm: "",
  });

  assert.equal(where.loanApplicationId, "loan-1");
  assert.equal(where.requiresClientSignature, true);
  assert.equal(where.requestApplicationLenderId, "lender-app-1");
});

test("buildBrokerSignDocumentWhere applies broker-uploads filter", () => {
  const where = buildBrokerSignDocumentWhere("loan-1", {
    lenderId: "broker-uploads",
    searchTerm: "",
  });

  assert.equal(where.loanApplicationId, "loan-1");
  assert.equal(where.requiresClientSignature, true);
  assert.equal(where.source, "BROKER_ADDED");
  assert.equal(where.requestApplicationLenderId, undefined);
});

test("listClientSignDocuments filters by bucket and scope", async () => {
  const {
    listClientSignDocuments,
    matchesClientBucket,
  } = require("../../utils/documents/listSignDocuments");

  assert.equal(matchesClientBucket({ clientBucket: "actionRequired" }, "actionRequired"), true);
  assert.equal(matchesClientBucket({ clientBucket: "completed" }, "actionRequired"), false);

  const prisma = {
    applicationDocumentRequirement: {
      findMany: async () => [],
    },
  };

  const result = await listClientSignDocuments(prisma, {
    loanApplicationId: "loan-1",
    scope: "signForms",
    bucket: "all",
  });

  assert.equal(result.data.length, 0);
  assert.equal(result.summary.actionRequired, 0);
});

test("appendSignDocumentSearch wraps base where with OR clause", () => {
  const where = appendSignDocumentSearch(
    { loanApplicationId: "loan-1", requiresClientSignature: true },
    "sba",
  );

  assert.ok(Array.isArray(where.AND));
  assert.equal(where.AND.length, 2);
  assert.ok(where.AND[1].OR);
});
