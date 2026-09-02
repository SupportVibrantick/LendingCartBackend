const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_KEYS = [
  "NODE_ENV",
  "SOCKET_CORS_ORIGINS",
  "CORS_ORIGINS",
  "SOCKET_CORS_DOMAIN_SUFFIX",
  "CORS_DOMAIN_SUFFIX",
  "FRONTEND_URL",
  "BROKER_DASHBOARD_URL",
  "LENDER_DASHBOARD_URL",
  "LOAN_AI_URL",
  "EMBED_APP_URL",
];

function withEnv(overrides, fn) {
  const snapshot = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);

  delete require.cache[require.resolve("../config/env")];
  const helpers = require("../config/env");

  try {
    return fn(helpers);
  } finally {
    for (const key of ENV_KEYS) {
      delete process.env[key];
      if (snapshot[key] !== undefined) {
        process.env[key] = snapshot[key];
      }
    }
    delete require.cache[require.resolve("../config/env")];
  }
}

test("allows explicit socket origins", () => {
  withEnv(
    {
      NODE_ENV: "production",
      SOCKET_CORS_ORIGINS:
        "https://broker-lendingcart.vibrantick.org,https://lender-lendingcart.vibrantick.org",
    },
    ({ isSocketOriginAllowed }) => {
      assert.equal(
        isSocketOriginAllowed("https://broker-lendingcart.vibrantick.org"),
        true,
      );
      assert.equal(
        isSocketOriginAllowed("https://lender-lendingcart.vibrantick.org"),
        true,
      );
      assert.equal(isSocketOriginAllowed("https://evil.example.com"), false);
    },
  );
});

test("allows subdomain suffix when configured", () => {
  withEnv(
    {
      NODE_ENV: "production",
      SOCKET_CORS_DOMAIN_SUFFIX: "vibrantick.org",
    },
    ({ isSocketOriginAllowed }) => {
      assert.equal(
        isSocketOriginAllowed("https://broker-lendingcart.vibrantick.org"),
        true,
      );
      assert.equal(
        isSocketOriginAllowed("https://lender-lendingcart.vibrantick.org"),
        true,
      );
      assert.equal(isSocketOriginAllowed("https://vibrantick.org"), true);
      assert.equal(isSocketOriginAllowed("https://other.com"), false);
    },
  );
});
