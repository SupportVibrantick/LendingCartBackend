const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_KEY = crypto.randomBytes(32).toString("hex");

describe("secretEncryption", () => {
  let restoreKey;

  beforeEach(() => {
    restoreKey = process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY;
    process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    delete require.cache[require.resolve("../../utils/security/secretEncryption")];
  });

  afterEach(() => {
    if (restoreKey === undefined) {
      delete process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = restoreKey;
    }
    delete require.cache[require.resolve("../../utils/security/secretEncryption")];
  });

  it("encrypts and decrypts a secret round-trip", () => {
    const { encryptSecret, decryptSecret, isEncryptedSecret } = require(
      "../../utils/security/secretEncryption",
    );

    const encrypted = encryptSecret("super-secret-token");
    assert.match(encrypted, /^enc:v1:/);
    assert.notEqual(encrypted, "super-secret-token");
    assert.equal(isEncryptedSecret(encrypted), true);
    assert.equal(decryptSecret(encrypted), "super-secret-token");
  });

  it("rejects invalid ciphertext format", () => {
    const { decryptSecret } = require("../../utils/security/secretEncryption");
    assert.throws(() => decryptSecret("plain-text"), /Unsupported secret ciphertext format/);
  });
});
