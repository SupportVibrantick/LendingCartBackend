const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

describe("ghlOAuthState", () => {
  let restoreSecret;
  const TEST_SECRET = "test-jwt-secret-for-ghl-oauth-state";

  beforeEach(() => {
    restoreSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
    delete require.cache[require.resolve("../../utils/auth/jwtSecret")];
    delete require.cache[require.resolve("../../services/ghl/ghlOAuthState")];
  });

  afterEach(() => {
    if (restoreSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = restoreSecret;
    delete require.cache[require.resolve("../../utils/auth/jwtSecret")];
    delete require.cache[require.resolve("../../services/ghl/ghlOAuthState")];
  });

  it("creates and verifies OAuth state", () => {
    const { createOAuthState, verifyOAuthState } = require(
      "../../services/ghl/ghlOAuthState",
    );

    const orgId = "11111111-1111-1111-1111-111111111111";
    const userId = "22222222-2222-2222-2222-222222222222";
    const { state } = createOAuthState({ organizationId: orgId, userId });

    const verified = verifyOAuthState(state);
    assert.equal(verified.ok, true);
    assert.equal(verified.organizationId, orgId);
    assert.equal(verified.userId, userId);
  });

  it("rejects tampered state", () => {
    const { createOAuthState, verifyOAuthState } = require(
      "../../services/ghl/ghlOAuthState",
    );
    const { state } = createOAuthState({
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
    });

    const tampered = `${state}x`;
    const verified = verifyOAuthState(tampered);
    assert.equal(verified.ok, false);
  });

  it("rejects expired state", () => {
    delete require.cache[require.resolve("../../utils/auth/jwtSecret")];
    const secret = require("../../utils/auth/jwtSecret");
    const token = jwt.sign(
      {
        purpose: "broker_ghl_oauth",
        organizationId: "11111111-1111-1111-1111-111111111111",
        userId: "22222222-2222-2222-2222-222222222222",
        nonce: "abc",
      },
      secret,
      { expiresIn: -1 },
    );

    const { verifyOAuthState } = require("../../services/ghl/ghlOAuthState");
    const verified = verifyOAuthState(token);
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "state_expired");
  });
});
