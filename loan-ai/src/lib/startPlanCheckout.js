import { startLoanAiCheckout } from "./loanAiAuth";
import { getCheckoutUserMessage } from "./checkoutErrors";

const CHECKOUT_URL_KEY = "loan_ai_ghl_checkout_url";
const CHECKOUT_ID_KEY = "loan_ai_ghl_checkout_id";

/**
 * Build return URLs for after GHL payment (hosted on this marketing site).
 * Use path-based URLs (no hash) — GHL redirect often drops URL fragments.
 * Note: GHL *invoice* pages often ignore redirectUrl; we still pass them for
 * payment-link / future GHL behavior. Primary UX is new-tab + pending page.
 */
export function buildCheckoutReturnUrls() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    successUrl: `${origin}/checkout/success?status=success`,
    cancelUrl: `${origin}/checkout/cancelled?status=cancelled`,
  };
}

export function storeCheckoutUrl(url) {
  if (!url || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHECKOUT_URL_KEY, url);
  } catch {
    // ignore quota / private mode
  }
}

export function storeCheckoutId(checkoutId) {
  if (!checkoutId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHECKOUT_ID_KEY, checkoutId);
  } catch {
    // ignore
  }
}

export function getStoredCheckoutUrl() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(CHECKOUT_URL_KEY);
  } catch {
    return null;
  }
}

export function getStoredCheckoutId() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(CHECKOUT_ID_KEY);
  } catch {
    return null;
  }
}

export function clearStoredCheckoutUrl() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHECKOUT_URL_KEY);
    sessionStorage.removeItem(CHECKOUT_ID_KEY);
  } catch {
    // ignore
  }
}

/**
 * Open GHL checkout in a new tab (user stays on Loan AI).
 * Must be called from a user gesture when possible (avoids popup blockers).
 * @returns {{ checkoutUrl: string, opened: boolean }}
 */
export function openCheckoutInNewTab(checkoutUrl) {
  if (!checkoutUrl) {
    return { checkoutUrl: null, opened: false };
  }
  storeCheckoutUrl(checkoutUrl);
  const win = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  return { checkoutUrl, opened: Boolean(win) };
}

/**
 * Call LendingCart checkout API and open GHL payment in a new tab.
 * Caller should navigate to /checkout/pending so the user is not stuck on GHL.
 * @returns {Promise<{ checkoutUrl: string, opened: boolean, checkoutId: string|null }>}
 */
export async function startPlanCheckoutAndRedirect({
  token,
  packageId,
  billingCycle,
  organizationName,
  organizationEmail,
  organizationPhone,
  firstName,
  lastName,
  addOnCodes,
  phone,
}) {
  if (!token) {
    throw new Error(getCheckoutUserMessage({ code: "UNAUTHORIZED" }));
  }
  if (!packageId) {
    throw new Error(getCheckoutUserMessage({ code: "INVALID_PACKAGE" }));
  }
  if (!organizationName?.trim()) {
    throw new Error("Organization name is required.");
  }
  if (!organizationEmail?.trim()) {
    throw new Error("Organization email is required.");
  }
  if (!organizationPhone && !phone) {
    throw new Error("Organization phone is required.");
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    throw new Error("First and last name are required.");
  }

  const cycle = billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY";
  const { successUrl, cancelUrl } = buildCheckoutReturnUrls();

  try {
    const json = await startLoanAiCheckout(token, {
      packageId,
      billingCycle: cycle,
      successUrl,
      cancelUrl,
      organizationName: organizationName.trim(),
      organizationEmail: organizationEmail.trim().toLowerCase(),
      organizationPhone: String(organizationPhone || phone).replace(/\D/g, ""),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      addOnCodes: addOnCodes || [],
    });

    const checkoutUrl = json.checkoutUrl || json.data?.checkoutUrl;
    const checkoutId = json.checkoutId || json.data?.checkoutId || null;
    if (!checkoutUrl) {
      throw new Error(
        getCheckoutUserMessage({ code: "CHECKOUT_CREATE_FAILED" }),
      );
    }

    if (checkoutId) storeCheckoutId(checkoutId);
    const opened = openCheckoutInNewTab(checkoutUrl);
    return { ...opened, checkoutId };
  } catch (err) {
    throw new Error(getCheckoutUserMessage(err));
  }
}
