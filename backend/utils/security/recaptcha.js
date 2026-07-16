/**
 * Verify Google reCAPTCHA token.
 * If RECAPTCHA_SECRET_KEY is not set, verification is skipped (dev-friendly).
 */
async function verifyRecaptchaToken(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const required = String(process.env.PUBLIC_SIGNUP_REQUIRE_CAPTCHA || "")
    .toLowerCase()
    .trim() === "true";

  if (!secret) {
    if (required) {
      return {
        ok: false,
        message: "reCAPTCHA is not configured on the server",
      };
    }
    return { ok: true, skipped: true, score: null };
  }

  if (!token) {
    return { ok: false, message: "reCAPTCHA token is required" };
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", String(token));
  if (remoteIp) params.set("remoteip", String(remoteIp));

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    return {
      ok: false,
      message: "reCAPTCHA verification failed",
      details: json["error-codes"] || [],
    };
  }

  // v3 score (optional)
  if (typeof json.score === "number") {
    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
    if (json.score < minScore) {
      return {
        ok: false,
        message: "reCAPTCHA score too low",
        score: json.score,
      };
    }
  }

  return { ok: true, score: json.score ?? null };
}

function isCaptchaConfigured() {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

function getCaptchaSiteKey() {
  return process.env.RECAPTCHA_SITE_KEY || process.env.VITE_RECAPTCHA_SITE_KEY || "";
}

module.exports = {
  verifyRecaptchaToken,
  isCaptchaConfigured,
  getCaptchaSiteKey,
};
