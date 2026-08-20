const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_KEY = crypto.randomBytes(32).toString("hex");
const AXIOS_PATH = require.resolve("axios");

function applyOAuthEnv() {
  process.env.GHL_OAUTH_CLIENT_ID = "client-id";
  process.env.GHL_OAUTH_CLIENT_SECRET = "client-secret";
  process.env.GHL_OAUTH_REDIRECT_URI =
    "http://localhost:4000/broker/integrations/ghl/callback";
  process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
}

function clearOAuthModules() {
  delete require.cache[require.resolve("../../utils/security/secretEncryption")];
  delete require.cache[require.resolve("../../services/ghl/ghlOAuth.service")];
}

function mockAxiosPost(impl) {
  const original = require(AXIOS_PATH);
  require.cache[AXIOS_PATH].exports = {
    ...original,
    post: impl,
  };
  return () => {
    require.cache[AXIOS_PATH].exports = original;
  };
}

describe("ghlOAuth callback token exchange", () => {
  let restoreAxios;

  beforeEach(() => {
    applyOAuthEnv();
    clearOAuthModules();
  });

  afterEach(() => {
    if (restoreAxios) restoreAxios();
    clearOAuthModules();
  });

  it("exchanges authorization code for location-scoped tokens", async () => {
    restoreAxios = mockAxiosPost(async (url, body, options) => {
      assert.equal(url, "https://services.leadconnectorhq.com/oauth/token");
      // Body is form-urlencoded string
      assert.equal(typeof body, "string");
      const params = new URLSearchParams(body);
      assert.equal(params.get("grant_type"), "authorization_code");
      assert.equal(params.get("code"), "auth-code-123");
      assert.equal(params.get("user_type"), "Location");
      assert.equal(params.get("client_id"), "client-id");
      assert.equal(params.get("client_secret"), "client-secret");
      assert.equal(params.get("redirect_uri"), process.env.GHL_OAUTH_REDIRECT_URI);
      // Headers
      assert.equal(options?.headers?.["Content-Type"], "application/x-www-form-urlencoded");
      assert.equal(options?.headers?.Accept, "application/json");
      return {
        data: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 86400,
          scope: "contacts.readonly contacts.write",
          userType: "Location",
          locationId: "loc_callback_1",
          companyId: "company_callback_1",
        },
      };
    });

    const service = require("../../services/ghl/ghlOAuth.service");
    const result = await service.exchangeAuthorizationCode("auth-code-123");

    assert.equal(result.accessToken, "access-token");
    assert.equal(result.refreshToken, "refresh-token");
    assert.equal(result.locationId, "loc_callback_1");
    assert.equal(result.companyId, "company_callback_1");
    assert.deepEqual(result.scopes, ["contacts.readonly", "contacts.write"]);
  });

  it("rejects token responses without locationId", async () => {
    restoreAxios = mockAxiosPost(async () => ({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 86400,
        userType: "Company",
        companyId: "company_only",
      },
    }));

    const service = require("../../services/ghl/ghlOAuth.service");
    await assert.rejects(
      () => service.exchangeAuthorizationCode("auth-code-456"),
      (err) => err.code === "MISSING_LOCATION",
    );
  });
});
