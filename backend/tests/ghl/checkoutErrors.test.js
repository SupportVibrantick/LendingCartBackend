const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  toCheckoutErrorResponse,
  checkoutError,
  CHECKOUT_ERROR_CODES,
  USER_MESSAGES,
} = require("../../services/ghl/ghlCheckoutErrors");
const {
  loanAiCheckoutSchema,
} = require("../../schemas/public/loanAi/auth.schema");

describe("Checkout auth / validation / GHL failure mapping (7–11)", () => {
  it("7. Unauthenticated user → UNAUTHORIZED (safe message)", () => {
    const mapped = toCheckoutErrorResponse(
      Object.assign(new Error("Authentication required"), { statusCode: 401 }),
    );
    assert.equal(mapped.statusCode, 401);
    assert.equal(mapped.body.code, CHECKOUT_ERROR_CODES.UNAUTHORIZED);
    assert.equal(
      mapped.body.message,
      USER_MESSAGES[CHECKOUT_ERROR_CODES.UNAUTHORIZED],
    );
    assert.equal(mapped.body.success, false);
  });

  it("8. Invalid package via schema (bad packageId)", () => {
    const parsed = loanAiCheckoutSchema.safeParse({
      packageId: "not-a-uuid",
      billingCycle: "MONTHLY",
      organizationName: "Acme Brokers",
      organizationEmail: "ops@acme.test",
      organizationPhone: "15551234567",
      firstName: "Alex",
      lastName: "Broker",
    });
    assert.equal(parsed.success, false);
    assert.match(
      parsed.error.issues[0]?.message || "",
      /uuid|packageId/i,
    );
  });

  it("9. Invalid billing period via schema", () => {
    const parsed = loanAiCheckoutSchema.safeParse({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      billingCycle: "WEEKLY",
      organizationName: "Acme Brokers",
      organizationEmail: "ops@acme.test",
      organizationPhone: "15551234567",
      firstName: "Alex",
      lastName: "Broker",
    });
    assert.equal(parsed.success, false);
  });

  it("9b. Organization details are required for checkout", () => {
    const parsed = loanAiCheckoutSchema.safeParse({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      billingCycle: "MONTHLY",
    });
    assert.equal(parsed.success, false);
  });

  it("9c. Valid checkout payload with organization details", () => {
    const parsed = loanAiCheckoutSchema.safeParse({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      billingCycle: "MONTHLY",
      organizationName: "Acme Brokers",
      organizationEmail: "ops@acme.test",
      organizationPhone: "15551234567",
      firstName: "Alex",
      lastName: "Broker",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.organizationName, "Acme Brokers");
    assert.equal(parsed.data.organizationPhone, "15551234567");
  });

  it("10. Missing GHL price maps to safe client response", () => {
    const mapped = toCheckoutErrorResponse(
      checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 503),
    );
    assert.equal(mapped.statusCode, 503);
    assert.equal(mapped.body.code, CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE);
    assert.doesNotMatch(mapped.body.message, /GHL_|price_id|env/i);
  });

  it("11. GHL API failure — raw provider text never exposed", () => {
    const mapped = toCheckoutErrorResponse(
      new Error(
        "GHL request failed: leadconnectorhq.com ECONNRESET pit-abc123secret",
      ),
    );
    assert.equal(mapped.body.code, CHECKOUT_ERROR_CODES.GHL_API_FAILED);
    assert.equal(
      mapped.body.message,
      USER_MESSAGES[CHECKOUT_ERROR_CODES.GHL_API_FAILED],
    );
    assert.doesNotMatch(mapped.body.message, /leadconnector|pit-|ECONN/i);

    const authMapped = toCheckoutErrorResponse(
      new Error("GHL unauthorized (401): check GHL_API_KEY — secret-value"),
    );
    assert.equal(authMapped.body.code, CHECKOUT_ERROR_CODES.GHL_AUTH_FAILED);
    assert.doesNotMatch(authMapped.body.message, /GHL_API_KEY|secret-value/i);
  });
});
