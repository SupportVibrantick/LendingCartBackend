const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveLoanProductsForBrokerDoc,
} = require("../utils/documents/brokerCustomDocumentProducts");

describe("resolveLoanProductsForBrokerDoc", () => {
  it("resolves by loanProductCode", async () => {
    const prisma = {
      loanProduct: {
        async findMany({ where }) {
          assert.ok(where.OR.some((clause) => clause.code));
          return [
            {
              id: "prod-1",
              code: "BRIDGE_LOAN_1_TO_4_UNITS",
              name: "Bridge Loan 1 to 4 Units",
            },
          ];
        },
      },
    };

    const result = await resolveLoanProductsForBrokerDoc(
      prisma,
      [],
      "BRIDGE_LOAN_1_TO_4_UNITS",
    );
    assert.equal(result.ok, true);
    assert.equal(result.products[0].code, "BRIDGE_LOAN_1_TO_4_UNITS");
  });

  it("requires at least one product id or code", async () => {
    const result = await resolveLoanProductsForBrokerDoc({}, [], []);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });
});
