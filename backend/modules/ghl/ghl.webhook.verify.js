const crypto = require("crypto");
const {
  getGhlEd25519PublicKey,
  getGhlRsaPublicKey,
} = require("./ghl.webhook.keys");

function headerValue(headers, name) {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === lower) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return null;
}

function verifyLegacyRsa(rawBody, signature, publicKeyPem) {
  if (!signature || signature === "N/A") {
    return { ok: false, reason: "no signature" };
  }
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(rawBody);
    verifier.end();
    const ok = verifier.verify(publicKeyPem, signature, "base64");
    return { ok, reason: ok ? null : "legacy verify failed", method: "X-WH-Signature" };
  } catch (err) {
    return { ok: false, reason: err.message, method: "X-WH-Signature" };
  }
}

function verifyEd25519(rawBody, signature, publicKeyPem) {
  if (!signature || signature === "N/A") {
    return { ok: false, reason: "no signature" };
  }
  try {
    const payloadBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(String(rawBody), "utf8");
    const signatureBuffer = Buffer.from(signature, "base64");
    const ok = crypto.verify(null, payloadBuffer, publicKeyPem, signatureBuffer);
    return { ok, reason: ok ? null : "ghl verify failed", method: "X-GHL-Signature" };
  } catch (err) {
    return { ok: false, reason: err.message, method: "X-GHL-Signature" };
  }
}

function verifySharedSecret(headers) {
  const expected = process.env.GHL_INBOUND_WEBHOOK_SECRET;
  if (!expected || !String(expected).trim()) {
    return { ok: false, reason: "shared secret not configured" };
  }
  const secret = String(expected).trim();
  const candidates = [
    headerValue(headers, "x-ghl-webhook-secret"),
    headerValue(headers, "x-webhook-secret"),
    headerValue(headers, "authorization"),
  ].filter(Boolean);

  for (const value of candidates) {
    const token = String(value).replace(/^Bearer\s+/i, "").trim();
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(secret);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, method: "shared-secret" };
      }
    } catch {
      // continue
    }
  }
  return { ok: false, reason: "shared secret mismatch" };
}

/**
 * Verify inbound GHL webhook authenticity.
 * Prefer X-GHL-Signature (Ed25519), then X-WH-Signature (RSA), then optional shared secret.
 *
 * @param {Buffer|string} rawBody
 * @param {Record<string, string|string[]>} headers
 */
function verifyGhlWebhookSignature(rawBody, headers = {}) {
  const skipRequested =
    process.env.GHL_WEBHOOK_SKIP_VERIFY === "true" ||
    process.env.GHL_WEBHOOK_SKIP_VERIFY === "1";

  // Never allow signature bypass in production
  if (skipRequested && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      reason: "GHL_WEBHOOK_SKIP_VERIFY is not allowed in production",
    };
  }

  if (skipRequested && process.env.NODE_ENV !== "production") {
    return { ok: true, method: "skip-verify-dev", reason: null };
  }

  const body = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ""), "utf8");

  const ghlSig = headerValue(headers, "x-ghl-signature");
  if (ghlSig) {
    return verifyEd25519(body, ghlSig, getGhlEd25519PublicKey());
  }

  const legacySig = headerValue(headers, "x-wh-signature");
  if (legacySig) {
    return verifyLegacyRsa(body, legacySig, getGhlRsaPublicKey());
  }

  const shared = verifySharedSecret(headers);
  if (shared.ok) return shared;

  return {
    ok: false,
    reason:
      "Missing X-GHL-Signature / X-WH-Signature (and no valid shared secret)",
  };
}

module.exports = {
  verifyGhlWebhookSignature,
  verifyEd25519,
  verifyLegacyRsa,
  headerValue,
};
