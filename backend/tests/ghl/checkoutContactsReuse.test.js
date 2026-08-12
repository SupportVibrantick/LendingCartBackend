const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, findReusableOpenCheckout } = require("./helpers");

describe("Repeated checkout click (17)", () => {
  it("reuses open CHECKOUT_CREATED session within duplicate window", () => {
    const now = Date.now();
    const open = {
      id: "co_1",
      loanAiUserId: "user_1",
      packageId: "pkg_1",
      billingCycle: "MONTHLY",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      checkoutUrl: "https://pay.example/a",
      createdAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 86_400_000).toISOString(),
    };
    const older = {
      ...open,
      id: "co_0",
      createdAt: new Date(now - 120_000).toISOString(),
      checkoutUrl: "https://pay.example/old",
    };
    const found = findReusableOpenCheckout([older, open], {
      loanAiUserId: "user_1",
      packageId: "pkg_1",
      billingCycle: "MONTHLY",
    });
    assert.equal(found.id, "co_1");
    assert.equal(found.checkoutUrl, "https://pay.example/a");
  });

  it("does not reuse failed or expired checkouts", () => {
    const now = Date.now();
    const failed = {
      id: "co_fail",
      loanAiUserId: "user_1",
      packageId: "pkg_1",
      billingCycle: "MONTHLY",
      status: "FAILED",
      paymentStatus: "FAILED",
      checkoutUrl: "https://pay.example/fail",
      createdAt: new Date(now - 10_000).toISOString(),
      expiresAt: null,
    };
    const expired = {
      id: "co_exp",
      loanAiUserId: "user_1",
      packageId: "pkg_1",
      billingCycle: "MONTHLY",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      checkoutUrl: "https://pay.example/exp",
      createdAt: new Date(now - 10_000).toISOString(),
      expiresAt: new Date(now - 1000).toISOString(),
    };
    assert.equal(
      findReusableOpenCheckout([failed, expired], {
        loanAiUserId: "user_1",
        packageId: "pkg_1",
        billingCycle: "MONTHLY",
      }),
      null,
    );
  });

  it("does not reuse outside the 15-minute window", () => {
    const now = Date.now();
    const stale = {
      id: "co_stale",
      loanAiUserId: "user_1",
      packageId: "pkg_1",
      billingCycle: "YEARLY",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      checkoutUrl: "https://pay.example/stale",
      createdAt: new Date(now - 16 * 60 * 1000).toISOString(),
      expiresAt: null,
    };
    assert.equal(
      findReusableOpenCheckout([stale], {
        loanAiUserId: "user_1",
        packageId: "pkg_1",
        billingCycle: "YEARLY",
      }),
      null,
    );
  });
});

describe("GHL contact upsert paths (18–19) + API failure (11)", () => {
  let restore;
  let ghlService;
  let ghlClient;
  let paymentService;
  let originals;

  beforeEach(() => {
    restore = applyPaymentEnv();
    ghlService = require("../../modules/ghl/ghl.service");
    ghlClient = require("../../modules/ghl/ghl.client");
    originals = {
      upsertGhlContact: ghlService.upsertGhlContact,
      requireContactApiCredentials: ghlService.requireContactApiCredentials,
      getLocationId: ghlService.getLocationId,
      createGhlApiClient: ghlClient.createGhlApiClient,
      formatGhlHttpError: ghlService.formatGhlHttpError,
      sanitizeAxiosError: ghlService.sanitizeAxiosError,
    };

    ghlService.requireContactApiCredentials = () => {};
    ghlService.getLocationId = () => "loc_test_123";
    ghlService.sanitizeAxiosError = (err) => err;
    ghlService.formatGhlHttpError = (err) =>
      new Error(err.message || "GHL request failed");

    // Fresh payment service after stubs (it closes over ghlService refs via require)
    delete require.cache[require.resolve("../../services/ghl/ghl.payment.service")];
    paymentService = require("../../services/ghl/ghl.payment.service");
  });

  afterEach(() => {
    ghlService.upsertGhlContact = originals.upsertGhlContact;
    ghlService.requireContactApiCredentials =
      originals.requireContactApiCredentials;
    ghlService.getLocationId = originals.getLocationId;
    ghlService.formatGhlHttpError = originals.formatGhlHttpError;
    ghlService.sanitizeAxiosError = originals.sanitizeAxiosError;
    ghlClient.createGhlApiClient = originals.createGhlApiClient;
    delete require.cache[require.resolve("../../services/ghl/ghl.payment.service")];
    restore();
  });

  function mockClient({ contactIdMode } = {}) {
    ghlClient.createGhlApiClient = () => ({
      get: async (url) => {
        if (String(url).startsWith("/users")) {
          return {
            data: {
              users: [
                {
                  id: "user_sender_1",
                  email: "billing@example.com",
                  firstName: "Billing",
                  lastName: "Sender",
                },
              ],
            },
          };
        }
        return {
          data: {
            price: {
              _id: "price_basic_monthly",
              amount: 49,
              currency: "USD",
              type: "recurring",
            },
          },
        };
      },
      post: async (url) => {
        if (url === "/invoices/") {
          return {
            data: {
              invoice: {
                _id: "inv_new_1",
                invoiceUrl: "https://pay.example/checkout-new",
              },
            },
          };
        }
        if (String(url).includes("/send")) {
          return {
            data: {
              emailData: {
                message: {
                  body: "View Invoice [https://pay.example/checkout-new]",
                },
              },
              invoice: {
                _id: "inv_new_1",
              },
            },
          };
        }
        return { data: {} };
      },
    });

    if (contactIdMode === "existing") {
      ghlService.upsertGhlContact = async () => ({
        ghlContactId: "contact_existing_99",
        created: false,
        updated: true,
      });
    } else if (contactIdMode === "new") {
      ghlService.upsertGhlContact = async () => ({
        ghlContactId: "contact_new_42",
        created: true,
        updated: false,
      });
    }
  }

  it("18. Existing GHL contact reuses contact id on checkout", async () => {
    mockClient({ contactIdMode: "existing" });
    delete require.cache[require.resolve("../../services/ghl/ghl.payment.service")];
    paymentService = require("../../services/ghl/ghl.payment.service");

    const session = await paymentService.createSubscriptionCheckout({
      email: "existing@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      packageCode: "BASIC",
      billingCycle: "MONTHLY",
      amount: 49,
      planName: "Basic",
      metadata: { lendingCartCheckoutId: "co_existing" },
    });

    assert.equal(session.ghlContactId, "contact_existing_99");
    assert.equal(session.priceId, "price_basic_monthly");
    assert.ok(session.checkoutUrl.includes("pay.example"));
  });

  it("19. New GHL contact creates contact id on checkout", async () => {
    mockClient({ contactIdMode: "new" });
    delete require.cache[require.resolve("../../services/ghl/ghl.payment.service")];
    paymentService = require("../../services/ghl/ghl.payment.service");

    const session = await paymentService.createSubscriptionCheckout({
      email: "newuser@example.com",
      firstName: "New",
      lastName: "User",
      packageCode: "PRO",
      billingCycle: "YEARLY",
      amount: 990,
      planName: "Pro",
      metadata: { lendingCartCheckoutId: "co_new" },
    });

    assert.equal(session.ghlContactId, "contact_new_42");
    assert.equal(session.packageCode, "PRO");
    assert.equal(session.billingCycle, "YEARLY");
    assert.equal(session.priceId, "price_pro_yearly");
  });

  it("11. GHL API failure during invoice create maps to safe error", async () => {
    ghlService.upsertGhlContact = async () => ({
      ghlContactId: "contact_x",
      created: true,
    });
    ghlClient.createGhlApiClient = () => ({
      get: async () => ({
        data: { price: { amount: 49, currency: "USD", type: "recurring" } },
      }),
      post: async () => {
        throw Object.assign(
          new Error("Request failed with status code 500"),
          {
            response: {
              status: 500,
              data: { message: "leadconnector internal boom" },
            },
          },
        );
      },
    });
    ghlService.formatGhlHttpError = () =>
      new Error("GHL_ API failure leadconnectorhq.com timeout");

    delete require.cache[require.resolve("../../services/ghl/ghl.payment.service")];
    paymentService = require("../../services/ghl/ghl.payment.service");

    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    try {
      await assert.rejects(
        () =>
          paymentService.createSubscriptionCheckout({
            email: "fail@example.com",
            packageCode: "BASIC",
            billingCycle: "MONTHLY",
            amount: 49,
          }),
        (err) =>
          ["GHL_API_FAILED", "CHECKOUT_CREATE_FAILED"].includes(err.code) &&
          !/leadconnector|GHL_/.test(err.message),
      );
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });
});