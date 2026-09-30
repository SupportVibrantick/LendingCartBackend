/**
 * Verify Google reCAPTCHA token.
 * If RECAPTCHA_SECRET_KEY is not set, verification is skipped (dev-friendly).
 * Captcha is only considered configured when BOTH secret and site key exist.
 */

function getCaptchaSiteKey() {
  return String(process.env.RECAPTCHA_SITE_KEY || "").trim();
}

function isCaptchaConfigured() {
  return Boolean(
    String(process.env.RECAPTCHA_SECRET_KEY || "").trim() && getCaptchaSiteKey(),
  );
}

function isPublicSignupCaptchaRequired() {
  const requiredExplicitly =
    String(process.env.PUBLIC_SIGNUP_REQUIRE_CAPTCHA || "")
      .toLowerCase()
      .trim() === "true";

  return requiredExplicitly || isCaptchaConfigured();
}

function mapRecaptchaError(errorCodes = []) {
  const codes = Array.isArray(errorCodes) ? errorCodes.map(String) : [];
  const joined = codes.length ? ` (${codes.join(", ")})` : "";

  if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) {
    return `reCAPTCHA secret key is invalid or missing on the server${joined}`;
  }
  if (codes.includes("missing-input-response")) {
    return `reCAPTCHA token is missing. Refresh the page and try again${joined}`;
  }
  if (codes.includes("invalid-input-response")) {
    return `reCAPTCHA token is invalid or expired. Refresh and try again${joined}`;
  }
  if (codes.includes("timeout-or-duplicate")) {
    return `reCAPTCHA token expired or was already used. Refresh and try again${joined}`;
  }
  if (codes.includes("bad-request")) {
    return `reCAPTCHA request was rejected. Check site/secret key pair and domains${joined}`;
  }
  if (codes.includes("browser-error")) {
    return `reCAPTCHA could not run in this browser. Disable blockers and retry${joined}`;
  }
  return `reCAPTCHA verification failed${joined}`;
}

/**
 * Parent domain allow-list: `loanautomation.ai` also matches `lender.loanautomation.ai`.
 */
function hostnameAllowed(hostname, allowedHosts) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host || !allowedHosts.length) return true;

  return allowedHosts.some((allowed) => {
    const a = String(allowed || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
    if (!a) return false;
    if (host === a) return true;
    // Allow first-level (and deeper) subdomains of an allowed parent domain.
    return host.endsWith(`.${a}`);
  });
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
    const errorCodes = json["error-codes"] || [];
    return {
      ok: false,
      message: mapRecaptchaError(errorCodes),
      details: errorCodes,
      hostname: json.hostname || null,
    };
  }

  // Optional hostname allow-list (comma-separated), e.g.
  // RECAPTCHA_ALLOWED_HOSTNAMES=loanautomation.ai,lender-lendingcart.vibrantick.org,localhost
  const allowedHosts = String(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length && json.hostname) {
    if (!hostnameAllowed(json.hostname, allowedHosts)) {
      return {
        ok: false,
        message: `reCAPTCHA hostname not allowed: ${json.hostname}`,
        details: ["hostname-mismatch"],
        hostname: json.hostname,
      };
    }
  }

  // v3 score (optional)
  if (typeof json.score === "number") {
    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.3);
    if (json.score < minScore) {
      return {
        ok: false,
        message: `reCAPTCHA score too low (${json.score}). Please try again.`,
        score: json.score,
        hostname: json.hostname || null,
      };
    }
  }

  return {
    ok: true,
    score: json.score ?? null,
    hostname: json.hostname || null,
    action: json.action || null,
  };
}

module.exports = {
  verifyRecaptchaToken,
  isCaptchaConfigured,
  isPublicSignupCaptchaRequired,
  getCaptchaSiteKey,
  hostnameAllowed,
};
