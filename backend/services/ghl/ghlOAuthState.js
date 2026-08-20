const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const jwtSecret = require("../../utils/auth/jwtSecret");

const STATE_TTL_SEC = 15 * 60;
const PURPOSE = "broker_ghl_oauth";

function createOAuthState({ organizationId, userId }) {
  if (!organizationId || !userId) {
    throw new Error("organizationId and userId are required for OAuth state");
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign(
    {
      purpose: PURPOSE,
      organizationId,
      userId,
      nonce,
    },
    jwtSecret,
    { expiresIn: STATE_TTL_SEC },
  );

  return { state: token, nonce, expiresInSec: STATE_TTL_SEC };
}

function verifyOAuthState(stateToken) {
  if (!stateToken || typeof stateToken !== "string") {
    return { ok: false, reason: "missing_state" };
  }

  try {
    const payload = jwt.verify(stateToken, jwtSecret);
    if (payload?.purpose !== PURPOSE) {
      return { ok: false, reason: "invalid_purpose" };
    }
    if (!payload.organizationId || !payload.userId) {
      return { ok: false, reason: "invalid_payload" };
    }
    return {
      ok: true,
      organizationId: payload.organizationId,
      userId: payload.userId,
      nonce: payload.nonce,
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return { ok: false, reason: "state_expired" };
    }
    return { ok: false, reason: "invalid_state" };
  }
}

module.exports = {
  createOAuthState,
  verifyOAuthState,
  STATE_TTL_SEC,
  PURPOSE,
};
