const assert = require("assert");
const {
  toCents,
  redactFinancialText,
  buildTransferParams,
  buildBankPayoutParams,
  applyCommissionAchWebhook,
} = require("../services/stripe/commissionAchPayout.service");
const {
  buildFundingPaymentIntentParams,
} = require("../services/stripe/commissionOrgFunding.service");
const { derivePayoutStatus } = require("../utils/commission/commissionHelpers");

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok ${name}`);
    })
    .catch((error) => {
      console.error(`fail ${name}`);
      throw error;
    });
}

async function main() {
  await test("derivePayoutStatus treats an in-flight ACH as sending", () => {
    assert.strictEqual(
      derivePayoutStatus(100, [{ amount: 100, status: "PROCESSING" }]),
      "PROCESSING",
    );
    assert.strictEqual(
      derivePayoutStatus(100, [{ amount: 100, status: "COMPLETED" }]),
      "PAID",
    );
    assert.strictEqual(
      derivePayoutStatus(100, [{ amount: 40, status: "FAILED" }]),
      "UNPAID",
    );
  });

  await test("transfer metadata does not include the bank account", () => {
    const built = buildTransferParams(
      { id: "payout-1", amount: 12.5 },
      "acct_123",
    );
    assert.strictEqual(built.params.amount, 1250);
    assert.strictEqual(built.params.metadata.commissionPayoutId, "payout-1");
    assert.strictEqual(built.params.account_number, undefined);
    assert.strictEqual(toCents(20.5), 2050);
    const hidden = redactFinancialText(
      "Invalid account 000123456789 routing 110000000",
      ["000123456789", "110000000"],
    );
    assert.strictEqual(hidden.includes("000123456789"), false);
    assert.strictEqual(hidden.includes("110000000"), false);
  });

  await test("bank payout uses a stable idempotency key", () => {
    const built = buildBankPayoutParams({ id: "payout-9", amount: 20 });
    assert.strictEqual(built.options.idempotencyKey, "commission-ach-payout-payout-9");
    assert.strictEqual(built.params.method, "standard");
    assert.strictEqual(built.params.metadata.account_number, undefined);
  });

  await test("payout.paid settles the commission payout", async () => {
    const updates = [];
    const audits = [];
    const db = {
      commissionPayout: {
        async findFirst() {
          return {
            id: "payout-1",
            status: "PROCESSING",
            brokerOrgId: "org-1",
            loanApplicationId: "loan-1",
            dealCommissionId: "deal-1",
            commissionInvoiceId: null,
            paymentReference: null,
            stripeTransferId: "tr_1",
            stripeReversalId: null,
          };
        },
        async update({ data }) {
          updates.push(data);
          return data;
        },
      },
      commissionAuditEvent: {
        async create({ data }) {
          audits.push(data);
          return data;
        },
      },
    };

    const result = await applyCommissionAchWebhook(db, {
      type: "payout.paid",
      data: {
        object: {
          id: "po_123",
          metadata: { commissionPayoutId: "payout-1" },
        },
      },
    });

    assert.strictEqual(result.action, "commission_ach_settled");
    assert.strictEqual(updates[0].status, "COMPLETED");
    assert.strictEqual(updates[0].paymentReference, "po_123");
    assert.strictEqual(audits[0].eventType, "PAYOUT_SETTLED");
  });

  await test("payout.failed reverses the transfer and marks the payout failed", async () => {
    const updates = [];
    let reversed = null;
    const db = {
      commissionPayout: {
        async findFirst() {
          return {
            id: "payout-2",
            status: "PROCESSING",
            brokerOrgId: "org-1",
            loanApplicationId: "loan-1",
            dealCommissionId: "deal-1",
            commissionInvoiceId: null,
            stripeTransferId: "tr_2",
            stripeReversalId: null,
          };
        },
        async update({ data }) {
          updates.push(data);
          return data;
        },
      },
      commissionAuditEvent: {
        async create() {
          return { id: "audit-1" };
        },
      },
    };
    const stripe = {
      transfers: {
        async createReversal(id) {
          reversed = id;
          return { id: "trr_2" };
        },
      },
    };

    const result = await applyCommissionAchWebhook(
      db,
      {
        type: "payout.failed",
        data: {
          object: {
            id: "po_fail",
            metadata: { commissionPayoutId: "payout-2" },
            failure_message: "Account closed 000999",
          },
        },
      },
      stripe,
    );

    assert.strictEqual(result.action, "commission_ach_failed");
    assert.strictEqual(result.reversed, true);
    assert.strictEqual(reversed, "tr_2");
    assert.strictEqual(updates[0].status, "FAILED");
    assert.strictEqual(String(updates[0].failureReason).includes("000999"), false);
  });

  await test("funding payment intent params debit the firm bank without exposing numbers in metadata", () => {
    const built = buildFundingPaymentIntentParams({
      payout: { id: "payout-fund-1", amount: 2000 },
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      requestIp: "8.8.8.8",
    });
    assert.strictEqual(built.params.amount, 200000);
    assert.strictEqual(built.params.customer, "cus_1");
    assert.strictEqual(built.params.payment_method, "pm_1");
    assert.strictEqual(built.params.metadata.commissionPayoutId, "payout-fund-1");
    assert.strictEqual(built.params.metadata.purpose, "commission_ach_funding");
    assert.strictEqual(built.params.metadata.account_number, undefined);
    assert.strictEqual(
      built.options.idempotencyKey,
      "commission-ach-funding-payout-fund-1",
    );
  });

  await test("payment_intent.payment_failed marks funding as failed", async () => {
    const updates = [];
    const db = {
      commissionPayout: {
        async findFirst() {
          return {
            id: "payout-fund-2",
            status: "PROCESSING",
            brokerOrgId: "org-1",
            loanApplicationId: "loan-1",
            dealCommissionId: "deal-1",
            commissionInvoiceId: null,
            stripePayoutId: null,
            stripePaymentIntentId: "pi_fail",
            amount: 100,
          };
        },
        async update({ data }) {
          updates.push(data);
          return { id: "payout-fund-2", ...data, amount: 100 };
        },
      },
      commissionAuditEvent: {
        async create() {
          return { id: "audit-fail" };
        },
      },
      dealCommission: {
        async findUnique() {
          return null;
        },
      },
      organizationBankingProfile: {
        async findUnique() {
          return null;
        },
      },
    };

    const result = await applyCommissionAchWebhook(db, {
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_fail",
          status: "requires_payment_method",
          metadata: {
            commissionPayoutId: "payout-fund-2",
            purpose: "commission_ach_funding",
          },
          last_payment_error: { message: "Insufficient funds 000111" },
        },
      },
    });

    assert.strictEqual(result.action, "commission_ach_funding_failed");
    assert.strictEqual(updates[0].status, "FAILED");
    assert.strictEqual(String(updates[0].failureReason).includes("000111"), false);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
