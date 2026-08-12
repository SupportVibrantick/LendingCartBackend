import { startLoanAiCheckout } from "./loanAiAuth";
import { getCheckoutUserMessage } from "./checkoutErrors";

/**
 * Build return URLs for after GHL payment (hosted on this marketing site).
 */
export function buildCheckoutReturnUrls() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    successUrl: `${origin}/?checkout=success#pricing`,
    cancelUrl: `${origin}/?checkout=cancelled#pricing`,
  };
}

/**
 * Call LendingCart checkout API and redirect the browser to GHL.
 * @param {{
 *   token: string,
 *   packageId: string,
 *   billingCycle: 'MONTHLY'|'YEARLY',
 *   phone?: string,
 * }} args
 * @returns {Promise<never>} redirects on success
 */
export async function startPlanCheckoutAndRedirect({
  token,
  packageId,
  billingCycle,
  phone,
}) {
  if (!token) {
    throw new Error(getCheckoutUserMessage({ code: "UNAUTHORIZED" }));
  }
  if (!packageId) {
    throw new Error(getCheckoutUserMessage({ code: "INVALID_PACKAGE" }));
  }

  const cycle = billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY";
  const { successUrl, cancelUrl } = buildCheckoutReturnUrls();

  try {
    const json = await startLoanAiCheckout(token, {
      packageId,
      billingCycle: cycle,
      successUrl,
      cancelUrl,
      phone,
    });

    const checkoutUrl = json.checkoutUrl || json.data?.checkoutUrl;
    if (!checkoutUrl) {
      throw new Error(
        getCheckoutUserMessage({ code: "CHECKOUT_CREATE_FAILED" }),
      );
    }

    window.location.href = checkoutUrl;
  } catch (err) {
    throw new Error(getCheckoutUserMessage(err));
  }
}
