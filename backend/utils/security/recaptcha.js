/**
 * Verify Google reCAPTCHA token.
 * If RECAPTCHA_SECRET_KEY is not set, verification is skipped (dev-friendly).
 * Captcha is only considered configured when BOTH secret and site key exist.
 */

function getCaptchaSiteKey() {
  return (
    process.env.RECAPTCHA_SITE_KEY ||
    process.env.VITE_RECAPTCHA_SITE_KEY ||
    ""
  ).trim();
}

function isCaptchaConfigured() {
  return Boolean(
    String(process.env.RECAPTCHA_SECRET_KEY || "").trim() && getCaptchaSiteKey(),
  );
}

function mapRecaptchaError(errorCodes = []) {
  const codes = Array.isArray(errorCodes) ? errorCodes : [];
  if (codes.includes("invalid-input-secret")) {
    return "reCAPTCHA secret key is invalid on the server";
  }
  if (codes.includes("invalid-input-response")) {
    return "reCAPTCHA token is invalid or expired. Please try again.";
  }
  if (codes.includes("timeout-or-duplicate")) {
    return "reCAPTCHA token expired. Please try again.";
  }
  if (codes.includes("bad-request")) {
    return "reCAPTCHA request was rejected. Check site key configuration.";
  }
  if (codes.includes("browser-error")) {
    return "reCAPTCHA could not run in this browser. Disable blockers and retry.";
  }
  return "reCAPTCHA verification failed";
}

async function verifyRecaptchaToken(token, remoteIp) {
  const secret = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
  const requiredExplicitly =
    String(process.env.PUBLIC_SIGNUP_REQUIRE_CAPTCHA || "")
      .toLowerCase()
      .trim() === "true";
  const configured = isCaptchaConfigured();

  // Production safety: never require captcha if site key is missing
  if (!secret || !configured) {
    if (requiredExplicitly && !configured) {
      return {
        ok: false,
        message:
          "reCAPTCHA is not fully configured (site key + secret required)",
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
      message: mapRecaptchaError(json["error-codes"]),
      details: json["error-codes"] || [],
    };
  }

  // Optional hostname allow-list (comma-separated), e.g.
  // RECAPTCHA_ALLOWED_HOSTNAMES=lender-lendingcart.vibrantick.org,localhost
  const allowedHosts = String(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length && json.hostname) {
    const hostname = String(json.hostname).toLowerCase();
    if (!allowedHosts.includes(hostname)) {
      return {
        ok: false,
        message: `reCAPTCHA hostname not allowed: ${hostname}`,
        details: ["hostname-mismatch"],
      };
    }
  }

  // v3 score (optional)
  if (typeof json.score === "number") {
    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.3);
    if (json.score < minScore) {
      return {
        ok: false,
        message: "reCAPTCHA score too low. Please try again.",
        score: json.score,
      };
    }
  }

  return { ok: true, score: json.score ?? null, hostname: json.hostname || null };
}

module.exports = {
  verifyRecaptchaToken,
  isCaptchaConfigured,
  getCaptchaSiteKey,
};
