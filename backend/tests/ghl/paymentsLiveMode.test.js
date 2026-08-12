const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, clearModule, reload } = require("./helpers");

describe("GHL payments liveMode (GHL_PAYMENTS_LIVE_MODE)", () => {
  let restore;
  let ghlService;
  let ghlClient;
  let originals;
  let lastCreateBody;
  let lastSendBody;

  beforeEach(() => {
    lastCreateBody = null;
    lastSendBody = null;
    restore = applyPaymentEnv({ GHL_PAYMENTS_LIVE_MODE: "true" });

    ghlService = require("../../modules/ghl/ghl.service");
    ghlClient = require("../../modules/ghl/ghl.client");
    originals = {
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
      post: async (url, body) => {
        if (url === "/invoices/") {
          lastCreateBody = body;
          return {
            data: {
              _id: "inv_mode_1",
              invoiceUrl: "https://pay.example/mode",
            },
          };
        }
        if (String(url).includes("/send")) {
          lastSendBody = body;
          return {
            data: {
              emailData: {
                message: {
                  body: "View Invoice [https://pay.example/mode]",
                },
              },
            },
          };
        }
        return { data: {} };
      },
    });

    clearModule("../../config/env");
    clearModule("../../services/ghl/ghl.payment.service");
  });

  afterEach(() => {
    ghlService.requireContactApiCredentials =
      originals.requireContactApiCredentials;
    ghlService.getLocationId = originals.getLocationId;
    ghlService.formatGhlHttpError = originals.formatGhlHttpError;
    ghlService.sanitizeAxiosError = originals.sanitizeAxiosError;
    ghlClient.createGhlApiClient = originals.createGhlApiClient;
    clearModule("../../config/env");
    clearModule("../../services/ghl/ghl.payment.service");
    restore();
  });

  async function loadPaymentServiceWithMode(modeValue) {
    restore();
    const overrides =
      modeValue === undefined
        ? { GHL_PAYMENTS_LIVE_MODE: null }
        : { GHL_PAYMENTS_LIVE_MODE: modeValue };
    restore = applyPaymentEnv(overrides);

    // Reloading config/env re-runs dotenv and may re-inject .env values.
    clearModule("../../config/env");
    reload("../../config/env");
    if (modeValue === undefined) {
      delete process.env.GHL_PAYMENTS_LIVE_MODE;
    } else {
      process.env.GHL_PAYMENTS_LIVE_MODE = String(modeValue);
    }

    clearModule("../../services/ghl/ghl.payment.service");
    return reload("../../services/ghl/ghl.payment.service");
  }

  it("GHL_PAYMENTS_LIVE_MODE=false => create + send use liveMode:false", async () => {
    const payment = await loadPaymentServiceWithMode("false");
    assert.equal(payment.resolveCheckoutLiveMode(), false);

    await payment.createGhlInvoice({
      contact: {
        ghlContactId: "c1",
        email: "mode-test@example.com",
        firstName: "Mode",
        lastName: "Test",
      },
      productId: "prod_test_123",
      priceId: "price_basic_monthly",
      amount: 49,
    });
    await payment.sendGhlInvoice("inv_mode_1", {
      email: "mode-test@example.com",
    });

    assert.equal(lastCreateBody.liveMode, false);
    assert.equal(lastSendBody.liveMode, false);
  });

  it("GHL_PAYMENTS_LIVE_MODE=true => create + send use liveMode:true", async () => {
    const payment = await loadPaymentServiceWithMode("true");
    assert.equal(payment.resolveCheckoutLiveMode(), true);

    await payment.createGhlInvoice({
      contact: {
        ghlContactId: "c1",
        email: "mode-live@example.com",
        firstName: "Mode",
        lastName: "Live",
      },
      productId: "prod_test_123",
      priceId: "price_basic_monthly",
      amount: 49,
    });
    await payment.sendGhlInvoice("inv_mode_1", {
      email: "mode-live@example.com",
    });

    assert.equal(lastCreateBody.liveMode, true);
    assert.equal(lastSendBody.liveMode, true);
  });

  it("missing GHL_PAYMENTS_LIVE_MODE defaults to true (production-safe)", async () => {
    const payment = await loadPaymentServiceWithMode(undefined);
    assert.equal(payment.resolveCheckoutLiveMode(), true);

    await payment.createGhlInvoice({
      contact: {
        ghlContactId: "c1",
        email: "mode-default@example.com",
        firstName: "Mode",
        lastName: "Default",
      },
      productId: "prod_test_123",
      priceId: "price_basic_monthly",
      amount: 49,
    });
    await payment.sendGhlInvoice("inv_mode_1", {
      email: "mode-default@example.com",
    });

    assert.equal(lastCreateBody.liveMode, true);
    assert.equal(lastSendBody.liveMode, true);
  });

  it("createSubscriptionCheckout passes the same liveMode to create and send", async () => {
    const payment = await loadPaymentServiceWithMode("false");
    const ghlServiceMod = require("../../modules/ghl/ghl.service");
    ghlServiceMod.upsertGhlContact = async () => ({
      ghlContactId: "contact_mode_same",
      created: true,
    });

    clearModule("../../services/ghl/ghl.payment.service");
    const paymentFresh = reload("../../services/ghl/ghl.payment.service");

    await paymentFresh.createSubscriptionCheckout({
      email: "same-mode@example.com",
      firstName: "Same",
      lastName: "Mode",
      packageCode: "BASIC",
      billingCycle: "MONTHLY",
      amount: 49,
      planName: "Basic",
    });

    assert.equal(lastCreateBody.liveMode, false);
    assert.equal(lastSendBody.liveMode, false);
    assert.equal(lastCreateBody.liveMode, lastSendBody.liveMode);
  });
});
