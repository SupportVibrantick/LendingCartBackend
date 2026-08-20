const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const PREFIX = "enc:v1:";

function resolveEncryptionKey() {
  const raw =
    process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY ||
    process.env.APP_SECRET_ENCRYPTION_KEY ||
    "";
  const trimmed = String(raw).trim();
  if (!trimmed) {
    throw new Error(
      "GHL_OAUTH_TOKEN_ENCRYPTION_KEY (or APP_SECRET_ENCRYPTION_KEY) is required to store OAuth tokens",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through
  }

  return crypto.createHash("sha256").update(trimmed).digest();
}

function encryptSecret(plaintext) {
  if (plaintext === undefined || plaintext === null) {
    throw new Error("encryptSecret requires a value");
  }
  const value = String(plaintext);
  if (!value) {
    throw new Error("encryptSecret requires a non-empty value");
  }

  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== "string") {
    throw new Error("decryptSecret requires ciphertext");
  }
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error("Unsupported secret ciphertext format");
  }

  const parts = ciphertext.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret payload");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = resolveEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  isEncryptedSecret,
  PREFIX,
};
