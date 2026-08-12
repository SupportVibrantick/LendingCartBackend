/**
 * User-facing auth (signup / login) error messages.
 * Keep these separate from checkout messages so signup never shows
 * "Please sign in to continue to checkout."
 */

function looksLikeRawProviderError(message) {
  return /GHL_|leadconnector|gohighlevel|pit-|Bearer |api key|stack|ECONN|ETIMEDOUT|axios/i.test(
    String(message || ""),
  );
}

/**
 * @param {unknown} err
 * @param {'register'|'login'} context
 * @returns {string}
 */
export function getAuthUserMessage(err, context = "register") {
  const message = String(err?.message || "").trim();
  const status = err?.status;
  const lower = message.toLowerCase();

  if (/already exists|already registered|email.*taken/i.test(lower)) {
    return "An account with this email already exists. Please sign in instead.";
  }

  if (/broker account|broker dashboard/i.test(lower)) {
    return "This email is already used for a broker account. Sign in to the broker dashboard instead.";
  }

  if (
    context === "login" &&
    (status === 401 || /invalid email|invalid password|incorrect/i.test(lower))
  ) {
    return "Incorrect email or password. Please try again.";
  }

  if (/password must|uppercase|lowercase|special character|at least 8/i.test(lower)) {
    return message;
  }

  if (/valid email|email is required|name is required|invalid registration/i.test(lower)) {
    return message;
  }

  if (message && !looksLikeRawProviderError(message)) {
    return message;
  }

  return context === "login"
    ? "Sign in failed. Please try again."
    : "We couldn't create your account. Please try again.";
}

